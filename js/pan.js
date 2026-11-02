// Drag-to-pan controller for one plane element.
//
// It owns the pan offset, the inertia glide, and the recenter ease. It never
// touches the DOM itself: every frame it calls onChange(pan) and lets the
// caller decide what to move.

const FRICTION = 0.94;         // velocity kept per frame during the glide
const MIN_VELOCITY = 0.05;     // px/frame at which the glide stops
const IDLE_RELEASE_MS = 80;    // a pointer still for this long does not glide
const RECENTER_MS = 560;       // length of the recenter ease
const CLICK_SLOP_PX = 6;       // drag distance that turns a click into a pan
const FRAME_MS = 1000 / 60;

export function createPan({ surface, onChange }) {
    // Plane offset from the origin, in CSS pixels.
    const pan = { x: 0, y: 0 };
    // Glide velocity in px/frame, carried over from the last drag.
    let velocity = { x: 0, y: 0 };
    // Live pointer drag: { id, x, y, time, distance }. Null when nobody drags.
    let drag = null;
    // Live recenter ease: { from, start }. Null when no ease runs.
    let ease = null;
    // Handle of the pending animation frame, or null.
    let frame = null;
    // Distance of the last completed drag. Guards accidental clicks.
    let lastDragDistance = 0;

    function requestFrame() {
        if (frame === null) frame = requestAnimationFrame(step);
    }

    function step(now) {
        frame = null;

        if (ease) advanceEase(now);
        else advanceGlide();

        onChange(pan);

        if (ease || velocity.x !== 0 || velocity.y !== 0) requestFrame();
    }

    function advanceGlide() {
        pan.x += velocity.x;
        pan.y += velocity.y;
        velocity.x *= FRICTION;
        velocity.y *= FRICTION;

        if (Math.hypot(velocity.x, velocity.y) < MIN_VELOCITY) velocity = { x: 0, y: 0 };
    }

    function advanceEase(now) {
        const t = Math.min(1, (now - ease.start) / RECENTER_MS);
        const eased = 1 - Math.pow(1 - t, 3);   // ease-out cubic

        pan.x = ease.from.x * (1 - eased);
        pan.y = ease.from.y * (1 - eased);

        if (t === 1) {
            pan.x = 0;
            pan.y = 0;
            ease = null;
        }
    }

    function onPointerDown(event) {
        if (event.button !== 0) return;

        surface.setPointerCapture(event.pointerId);
        surface.classList.add('is-dragging');

        ease = null;
        velocity = { x: 0, y: 0 };
        lastDragDistance = 0;
        drag = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            time: performance.now(),
            distance: 0
        };
    }

    function onPointerMove(event) {
        if (!drag || event.pointerId !== drag.id) return;

        const now = performance.now();
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        const elapsedFrames = (now - drag.time) / FRAME_MS;

        pan.x += dx;
        pan.y += dy;
        drag.distance += Math.hypot(dx, dy);

        // Blend each sample into the running velocity, so one jittery frame
        // cannot decide the whole glide.
        if (elapsedFrames > 0) {
            velocity.x = velocity.x * 0.3 + (dx / elapsedFrames) * 0.7;
            velocity.y = velocity.y * 0.3 + (dy / elapsedFrames) * 0.7;
        }

        drag.x = event.clientX;
        drag.y = event.clientY;
        drag.time = now;
        onChange(pan);
    }

    function onPointerUp(event) {
        if (!drag || event.pointerId !== drag.id) return;

        const wasIdle = performance.now() - drag.time > IDLE_RELEASE_MS;
        lastDragDistance = drag.distance;
        drag = null;
        surface.classList.remove('is-dragging');

        if (wasIdle) velocity = { x: 0, y: 0 };
        requestFrame();
    }

    surface.addEventListener('pointerdown', onPointerDown);
    surface.addEventListener('pointermove', onPointerMove);
    surface.addEventListener('pointerup', onPointerUp);
    surface.addEventListener('pointercancel', onPointerUp);

    return {
        recenter() {
            velocity = { x: 0, y: 0 };
            ease = { from: { x: pan.x, y: pan.y }, start: performance.now() };
            requestFrame();
        },

        // True when the pointer travelled far enough that the release was a
        // pan, not a click on whatever sat under it.
        wasDragged() {
            return lastDragDistance > CLICK_SLOP_PX;
        }
    };
}
