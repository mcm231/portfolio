// Home page: an endless cool-white plane you can drag in any direction.
// The name sits at the plane origin, so it pans with everything else.
// The recenter button eases the plane back to the origin.
(function () {
    'use strict';

    const viewport = document.getElementById('viewport');
    const world = document.getElementById('world');
    const grid = document.getElementById('grid');
    const recenter = document.getElementById('recenter');

    const FRICTION = 0.94;         // velocity kept per frame during the glide
    const MIN_VELOCITY = 0.05;     // px/frame at which the glide stops
    const IDLE_RELEASE_MS = 80;    // a pointer still for this long does not glide
    const RECENTER_MS = 520;       // length of the recenter ease
    const CENTERED_PX = 0.5;       // distance from origin still counted as centered
    const FRAME_MS = 1000 / 60;

    // Plane offset from the origin, in CSS pixels.
    let pan = { x: 0, y: 0 };
    // Glide velocity in px/frame, carried over from the last drag.
    let velocity = { x: 0, y: 0 };
    // Live pointer drag: { id, x, y, time }. Null when nobody drags.
    let drag = null;
    // Live recenter ease: { from, start }. Null when no ease runs.
    let ease = null;
    // Handle of the pending animation frame, or null.
    let frame = null;

    function render() {
        world.style.transform = `translate3d(${pan.x}px, ${pan.y}px, 0)`;
        grid.style.backgroundPosition = `${pan.x}px ${pan.y}px`;

        const centered = Math.abs(pan.x) < CENTERED_PX && Math.abs(pan.y) < CENTERED_PX;
        recenter.classList.toggle('is-hidden', centered);
    }

    function requestFrame() {
        if (frame === null) frame = requestAnimationFrame(step);
    }

    function step(now) {
        frame = null;

        if (ease) advanceEase(now);
        else advanceGlide();

        render();

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
            pan = { x: 0, y: 0 };
            ease = null;
        }
    }

    function onPointerDown(event) {
        if (event.button !== 0) return;

        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add('is-dragging');

        ease = null;
        velocity = { x: 0, y: 0 };
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    }

    function onPointerMove(event) {
        if (!drag || event.pointerId !== drag.id) return;

        const now = performance.now();
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        const elapsedFrames = (now - drag.time) / FRAME_MS;

        pan.x += dx;
        pan.y += dy;

        // Blend each sample into the running velocity, so one jittery frame
        // cannot decide the whole glide.
        if (elapsedFrames > 0) {
            velocity.x = velocity.x * 0.3 + (dx / elapsedFrames) * 0.7;
            velocity.y = velocity.y * 0.3 + (dy / elapsedFrames) * 0.7;
        }

        drag = { id: drag.id, x: event.clientX, y: event.clientY, time: now };
        render();
    }

    function onPointerUp(event) {
        if (!drag || event.pointerId !== drag.id) return;

        const wasIdle = performance.now() - drag.time > IDLE_RELEASE_MS;
        drag = null;
        viewport.classList.remove('is-dragging');

        if (wasIdle) velocity = { x: 0, y: 0 };
        requestFrame();
    }

    function onRecenter() {
        velocity = { x: 0, y: 0 };
        ease = { from: { x: pan.x, y: pan.y }, start: performance.now() };
        requestFrame();
    }

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    recenter.addEventListener('click', onRecenter);

    render();
})();
