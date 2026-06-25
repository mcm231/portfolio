// Maya Malavasi Interactive Portfolio with Page Transitions
const { useState, useEffect } = React;

// Portfolio data structure
const portfolioData = {
    title: 'Maya Malavasi',
    subtitle: 'Interactive Portfolio',
    categories: [
        {
            id: 'writing',
            name: 'Writing',
            url: 'pages/writing.html',
            color: 'rgb(99, 102, 241)',
            subcategories: ['Photography', 'Videography', 'Music', 'Sound Design', 'Editing', 'Storytelling', 'Composition', 'Color Grading']
        },
        {
            id: 'traditional-art',
            name: 'Traditional Art',
            url: 'pages/traditional-art.html',
            color: 'rgb(236, 72, 153)',
            subcategories: ['Watercolor', 'Acrylics', 'Charcoal', 'Pencil', 'Ink', 'Pastels', 'Oil Paint', 'Gouache']
        },
        {
            id: 'digital-art',
            name: 'Digital Art',
            url: 'pages/digital-art.html',
            color: 'rgb(59, 130, 246)',
            subcategories: ['Illustration', '3D Modeling', 'UI/UX', 'Animation', 'Concept Art', 'Graphic Design', 'Photo Editing', 'Digital Painting']
        },
        {
            id: 'programming',
            name: 'Programming',
            url: 'pages/programming.html',
            color: 'rgb(245, 158, 11)',
            subcategories: ['React', 'Python', 'JavaScript', 'TypeScript', 'Node.js', 'Django', 'APIs', 'Docker', 'Git']
        }
    ]
};

function Portfolio() {
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });

    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [velocity, setVelocity] = useState({ x: 0, y: 0 });
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [lastTime, setLastTime] = useState(Date.now());
    const [scale, setScale] = useState(1);
    const [transitioning, setTransitioning] = useState(false);
    const [transitionColor, setTransitionColor] = useState('');

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!isDragging && (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1)) {
            const friction = 0.92;
            const timer = setInterval(() => {
                setVelocity(prev => {
                    let newVelX = prev.x * friction;
                    let newVelY = prev.y * friction;

                    if (Math.abs(newVelX) < 0.1 && Math.abs(newVelY) < 0.1) {
                        clearInterval(timer);
                        return { x: 0, y: 0 };
                    }

                    setOffset(prevOffset => {
                        const desiredOffsetX = prevOffset.x + newVelX;
                        const desiredOffsetY = prevOffset.y + newVelY;

                        return {
                            x: desiredOffsetX,
                            y: desiredOffsetY
                        };
                    });

                    return { x: newVelX, y: newVelY };
                });
            }, 16);

            return () => clearInterval(timer);
        }
    }, [isDragging, velocity, windowSize]);

    useEffect(() => {
        const canvas = document.getElementById('canvas');
        if (!canvas) return;

        const wheelHandler = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.min(Math.max(scale * delta, 1), 8);

            if (newScale !== scale) {
                const mouseX = e.clientX;
                const mouseY = e.clientY;
                const centerX = windowSize.width / 2;
                const centerY = windowSize.height / 2;

                const diagramX = (mouseX - centerX - offset.x) / scale + centerX;
                const diagramY = (mouseY - centerY - offset.y) / scale + centerY;

                const newOffsetX = mouseX - (diagramX - centerX) * newScale - centerX;
                const newOffsetY = mouseY - (diagramY - centerY) * newScale - centerY;

                setOffset({ x: newOffsetX, y: newOffsetY });
                setScale(newScale);
            }
        };

        canvas.addEventListener('wheel', wheelHandler, { passive: false });
        return () => canvas.removeEventListener('wheel', wheelHandler);
    }, [scale, offset, windowSize]);

    const handleMouseDown = (e) => {
        if (e.target.id === 'canvas' || e.target.tagName === 'svg') {
            setIsDragging(true);
            setVelocity({ x: 0, y: 0 });
            setDragStart({
                x: e.clientX - offset.x,
                y: e.clientY - offset.y
            });
            setLastPos({ x: e.clientX, y: e.clientY });
            setLastTime(Date.now());
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging) {
            const now = Date.now();
            const dt = now - lastTime;

            if (dt > 0 && dt < 100) {
                const dx = e.clientX - lastPos.x;
                const dy = e.clientY - lastPos.y;

                setVelocity(prev => ({
                    x: (prev.x * 0.3) + ((dx / dt * 16) * 0.7),
                    y: (prev.y * 0.3) + ((dy / dt * 16) * 0.7)
                }));
            }

            const desiredOffsetX = e.clientX - dragStart.x;
            const desiredOffsetY = e.clientY - dragStart.y;

            setOffset({
                x: desiredOffsetX,
                y: desiredOffsetY
            });

            setLastPos({ x: e.clientX, y: e.clientY });
            setLastTime(now);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleReset = () => {
        setOffset({ x: 0, y: 0 });
        setScale(1);
        window.history.replaceState(null, '', window.location.pathname);
    };

    const handleRegionClick = (region, labelPosition) => {
        if (region.type === 'single' && labelPosition) {
            const category = region.category;

            const newScale = 8;

            const viewportCenterX = windowSize.width / 2;
            const viewportCenterY = windowSize.height / 2;

            const dx = labelPosition.x - viewportCenterX;
            const dy = labelPosition.y - viewportCenterY;

            const targetX = -dx * newScale;
            const targetY = -dy * newScale;

            setOffset({ x: targetX, y: targetY });
            setScale(newScale);

            window.history.pushState(null, '', `#${category.id}`);
        }
    };

    const centerX = windowSize.width / 2;
    const centerY = windowSize.height / 2;
    const vennSize = Math.min(windowSize.width, windowSize.height) * 1.0;
    const vennOpacity = Math.max(0, Math.min(0.85, 0.85 - ((scale - 1) / 1.5) * 0.85));

    const MIN_ZOOM = 1;
    const MAX_ZOOM = 8;
    const zoomProgress = (scale - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
    const textAndBorderOpacity = Math.max(0, 1 - zoomProgress);

    const petalClickThreshold = MIN_ZOOM + (MAX_ZOOM - MIN_ZOOM) * 0.5;
    const petalsClickable = scale < petalClickThreshold;

    return React.createElement('div', {
        style: {
            width: '100vw',
            height: '100vh',
            position: 'relative',
            overflow: 'hidden'
        }
    }, [
        transitioning ? React.createElement('div', {
            key: 'transition-overlay',
            style: {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: transitionColor,
                zIndex: 9999,
                animation: 'fadeInOverlay 0.8s ease-out forwards'
            }
        }) : null,

        React.createElement('div', {
            key: 'header',
            style: {
                position: 'fixed',
                top: '20px',
                left: '20px',
                color: 'white',
                zIndex: 1000
            }
        }, [
            React.createElement('h1', {
                key: 'title',
                style: { fontSize: '28px', fontWeight: '700', margin: 0 }
            }, portfolioData.title),
            React.createElement('p', {
                key: 'subtitle',
                style: { fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', margin: '5px 0 0 0' }
            }, portfolioData.subtitle)
        ]),

        React.createElement('div', {
            key: 'controls',
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 1000
            }
        }, [
            React.createElement('button', {
                key: 'reset',
                onClick: handleReset,
                style: {
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    backdropFilter: 'blur(10px)'
                },
                onMouseEnter: (e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)',
                onMouseLeave: (e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
            }, 'Reset View')
        ]),

        React.createElement('div', {
            key: 'canvas',
            id: 'canvas',
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseUp,
            style: {
                width: '100%',
                height: '100%',
                cursor: isDragging ? 'grabbing' : 'grab',
                position: 'relative',
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: transitioning ? 'transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1)' : (isDragging ? 'none' : 'transform 0.3s ease-out')
            }
        }, [
            React.createElement('svg', {
                key: 'venn-svg',
                style: {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none'
                }
            }, [
                React.createElement('g', {
                    key: 'venn-group',
                    style: { pointerEvents: 'auto' }
                }, [
                    React.createElement(window.VennDiagram, {
                        key: 'venn',
                        categories: portfolioData.categories,
                        centerX: centerX,
                        centerY: centerY,
                        size: vennSize,
                        opacity: vennOpacity,
                        textAndBorderOpacity: textAndBorderOpacity,
                        clickable: petalsClickable,
                        onRegionClick: handleRegionClick,
                        scale: scale
                    })
                ])
            ])
        ]),

        React.createElement('style', {
            key: 'transition-styles'
        }, `
            @keyframes fadeInOverlay {
                0% { opacity: 0; }
                100% { opacity: 1; }
            }
        `)
    ]);
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(React.createElement(Portfolio));

console.log('Portfolio with page transitions loaded!');
