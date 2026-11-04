// The pan and zoom controller, driven through a minimal DOM stub.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const listeners = new Map();
const surface = {
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener(type, fn) { listeners.set(type, fn); },
  setPointerCapture() { surface.captured = true; },
  releasePointerCapture() { surface.captured = false; },
  hasPointerCapture() { return Boolean(surface.captured); },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800 }),
  captured: false
};
let clock = 0;
globalThis.performance = { now: () => clock };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const { createPan } = await import(`${ROOT}/public/js/pan.js`);

let view = { x: 0, y: 0, scale: 1 };
const pan = createPan({ surface, onChange: v => { view = { ...v }; } });

const fire = (type, props) => listeners.get(type)({ preventDefault() {}, ...props });
const wheel = (deltaY, clientX = 500, clientY = 400) =>
  fire('wheel', { deltaY, deltaMode: 0, clientX, clientY });

const results = [];
const check = (label, got, want) => results.push([label, JSON.stringify(got), JSON.stringify(want)]);
const round = (n, places = 3) => Number(n.toFixed(places));

check('starts at 100 percent', view.scale, 1);

wheel(-200);                       // scroll up zooms in
check('a wheel up zooms in', view.scale > 1, true);

for (let i = 0; i < 40; i++) wheel(-300);
check('zoom stops at 250 percent', round(view.scale), 2.5);

for (let i = 0; i < 80; i++) wheel(300);
check('zoom stops at 50 percent', round(view.scale), 0.5);

// Zoom about a point keeps that point still. Read the live state first: the
// loops above left the controller at its floor.
const probe = { x: 700, y: 300 };             // a screen point, center is 500,400
const before = { ...view };
const planeX = (probe.x - 500 - before.x) / before.scale;
const planeY = (probe.y - 400 - before.y) / before.scale;
wheel(-200, probe.x, probe.y);
const afterX = 500 + view.x + planeX * view.scale;
const afterY = 400 + view.y + planeY * view.scale;
check('the point under the pointer holds', [round(afterX, 1), round(afterY, 1)], [700, 300]);

// The button step zooms about the middle, so the center pixel never moves.
const beforeZoom = { ...view };
const centerPlaneX = (500 - 500 - beforeZoom.x) / beforeZoom.scale;
const centerPlaneY = (400 - 400 - beforeZoom.y) / beforeZoom.scale;
pan.zoomBy(1.25);
check('zoomBy scales by the step', round(view.scale), round(beforeZoom.scale * 1.25));
check('zoomBy holds the center', [
  round(500 + view.x + centerPlaneX * view.scale, 1),
  round(400 + view.y + centerPlaneY * view.scale, 1)
], [500, 400]);

pan.zoomBy(100);
check('zoomBy obeys the ceiling', round(view.scale), 2.5);
pan.zoomBy(0.001);
check('zoomBy obeys the floor', round(view.scale), 0.5);

// A plain click must not capture the pointer, or the link under it dies.
clock = 0;
fire('pointerdown', { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
check('no capture on press', surface.hasPointerCapture(), false);
clock = 40;
fire('pointermove', { pointerId: 1, clientX: 12, clientY: 11 });
check('no capture under the slop', surface.hasPointerCapture(), false);
clock = 120;
fire('pointerup', { pointerId: 1 });
check('a short small press clicks', pan.wasDragged(), false);

// Same tiny movement, held past the time limit. That is a drag.
clock = 1000;
fire('pointerdown', { button: 0, pointerId: 3, clientX: 10, clientY: 10 });
clock = 1600;
fire('pointerup', { pointerId: 3 });
check('a long still press drags', pan.wasDragged(), true);

// Just inside the limit stays a click.
clock = 2000;
fire('pointerdown', { button: 0, pointerId: 4, clientX: 10, clientY: 10 });
clock = 2390;
fire('pointerup', { pointerId: 4 });
check('just inside the limit clicks', pan.wasDragged(), false);

// A real drag does capture, and counts as a drag.
clock = 3000;
fire('pointerdown', { button: 0, pointerId: 2, clientX: 10, clientY: 10 });
clock = 3050;
fire('pointermove', { pointerId: 2, clientX: 90, clientY: 10 });
check('a real drag captures', surface.hasPointerCapture(), true);
clock = 3100;
fire('pointerup', { pointerId: 2 });
check('capture is released', surface.hasPointerCapture(), false);
check('a big move is a drag', pan.wasDragged(), true);

let failed = 0;
for (const [label, got, want] of results) {
  const pass = got === want;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(32)} ${got}${pass ? '' : `  want ${want}`}`);
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
