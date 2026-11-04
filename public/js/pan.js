// Drag-to-pan controller for one plane element.
//
// It owns the pan offset, the inertia glide, and the recenter ease. It never
// touches the DOM itself: every frame it calls onChange(pan) and lets the
// caller decide what to move.

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const WHEEL_STEP = 0.0016;     // scale change per wheel pixel
const LINE_HEIGHT_PX = 16;     // a wheel line, when the event reports lines
const FRICTION = 0.94;         // velocity kept per frame during the glide
const MIN_VELOCITY = 0.05;     // px/frame at which the glide stops
const IDLE_RELEASE_MS = 80;    // a pointer still for this long does not glide
const RECENTER_MS = 560;       // length of the recenter ease
// Click or drag. A press counts as a click only when it stays inside the slop
// and ends inside the time limit. Raise CLICK_MAX_MS for a slower hand, lower
// it to make a held press start a pan sooner.
const CLICK_SLOP_PX = 6;       // movement a click may still have
const CLICK_MAX_MS = 400;      // longest press that still counts as a click
const FRAME_MS = 1000 / 60;

export function createPan({ surface, onChange }) {
    // Plane offset from the origin, in CSS pixels, and its zoom factor.
    const pan = { x: 0, y: 0, scale: 1 };
    // Glide velocity in px/frame, carried over from the last drag.
    let velocity = { x: 0, y: 0 };
    // Live pointer drag: { id, x, y, time, distance }. Null when nobody drags.
    let drag = null;
    // Live recenter ease: { from, start }. Null when no ease runs.
    let ease = null;
    // Handle of the pending animation frame, or null.
    let frame = null;
    // Shape of the last completed press. Guards accidental clicks.
    let lastPress = { distance: 0, duration: 0 };

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
        pan.scale = ease.from.scale + (1 - ease.from.scale) * eased;

        if (t === 1) {
            pan.x = 0;
            pan.y = 0;
            pan.scale = 1;
            ease = null;
        }
    }

    // Zooms about one screen point, so whatever sits under the pointer stays
    // under the pointer.
    function zoomAt(factor, clientX, clientY) {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pan.scale * factor));
        if (next === pan.scale) return;

        const box = surface.getBoundingClientRect();
        const centerX = box.left + box.width / 2;
        const centerY = box.top + box.height / 2;

        // The plane point now under the pointer. Screen = center + pan + point * scale.
        const pointX = (clientX - centerX - pan.x) / pan.scale;
        const pointY = (clientY - centerY - pan.y) / pan.scale;

        pan.x = clientX - centerX - pointX * next;
        pan.y = clientY - centerY - pointY * next;
        pan.scale = next;

        onChange(pan);
    }

    function onWheel(event) {
        event.preventDefault();

        ease = null;
        velocity = { x: 0, y: 0 };

        // deltaMode 1 counts lines, not pixels.
        const delta = event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT_PX : event.deltaY;
        zoomAt(Math.exp(-delta * WHEEL_STEP), event.clientX, event.clientY);
    }

    function onPointerDown(event) {
        if (event.button !== 0) return;

        surface.classList.add('is-dragging');

        ease = null;
        velocity = { x: 0, y: 0 };
        lastPress = { distance: 0, duration: 0 };
        const now = performance.now();
        drag = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            time: now,
            startedAt: now,
            distance: 0,
            captured: false
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

        // Capture only once this is a real drag. Capturing on pointerdown
        // would send the later click to this surface, and a link inside the
        // plane would never open.
        if (!drag.captured && drag.distance > CLICK_SLOP_PX) {
            surface.setPointerCapture(event.pointerId);
            drag.captured = true;
        }

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

        const now = performance.now();
        const wasIdle = now - drag.time > IDLE_RELEASE_MS;
        lastPress = { distance: drag.distance, duration: now - drag.startedAt };

        if (drag.captured && surface.hasPointerCapture(event.pointerId)) {
            surface.releasePointerCapture(event.pointerId);
        }

        drag = null;
        surface.classList.remove('is-dragging');

        if (wasIdle) velocity = { x: 0, y: 0 };
        requestFrame();
    }

    surface.addEventListener('pointerdown', onPointerDown);
    surface.addEventListener('pointermove', onPointerMove);
    surface.addEventListener('pointerup', onPointerUp);
    surface.addEventListener('pointercancel', onPointerUp);
    surface.addEventListener('wheel', onWheel, { passive: false });

    return {
        recenter() {
            velocity = { x: 0, y: 0 };
            ease = { from: { x: pan.x, y: pan.y, scale: pan.scale }, start: performance.now() };
            requestFrame();
        },

        // Steps the zoom about the middle of the surface, for the buttons.
        zoomBy(factor) {
            const box = surface.getBoundingClientRect();
            ease = null;
            velocity = { x: 0, y: 0 };
            zoomAt(factor, box.left + box.width / 2, box.top + box.height / 2);
        },

        // True when the last press was a pan, not a click on whatever sat
        // under it. Either too far, or held too long.
        wasDragged() {
            return lastPress.distance > CLICK_SLOP_PX || lastPress.duration > CLICK_MAX_MS;
        }
    };
}
