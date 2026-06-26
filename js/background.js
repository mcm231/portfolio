(function () {
    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');

    // Orb color palette — brighter blues/teals visible against the dark navy background
    const ORB_COLORS = [
        [60, 100, 200],
        [40, 120, 220],
        [80, 140, 230],
        [50, 90, 180],
        [100, 160, 240],
        [70, 110, 210],
    ];

    let orbs = [];

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function createOrb() {
        const color = ORB_COLORS[Math.floor(Math.random() * ORB_COLORS.length)];
        return {
            x: rand(0, canvas.width),
            y: rand(0, canvas.height),
            radius: rand(60, 180),
            color,
            maxOpacity: rand(0.45, 0.75),
            opacity: 0,
            phase: rand(0, Math.PI * 2),
            phaseSpeed: rand(0.00021, 0.00063),
        };
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Reposition orbs so they stay within bounds after resize
        orbs.forEach(o => {
            o.x = rand(0, canvas.width);
            o.y = rand(0, canvas.height);
        });
    }

    function init() {
        resize();
        orbs = Array.from({ length: 14 }, createOrb);
    }

    function draw(timestamp) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        orbs.forEach(o => {
            o.phase += o.phaseSpeed * 16; // advance by ~16ms worth
            // Sine wave gives a smooth, organic fade in/out (0 → maxOpacity → 0)
            o.opacity = o.maxOpacity * (0.5 + 0.5 * Math.sin(o.phase));

            const [r, g, b] = o.color;
            const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.radius);
            grad.addColorStop(0,   `rgba(${r}, ${g}, ${b}, ${o.opacity})`);
            grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${o.opacity})`);
            grad.addColorStop(1,   `rgba(${r}, ${g}, ${b}, 0)`);

            ctx.beginPath();
            ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    init();
    requestAnimationFrame(draw);
})();
