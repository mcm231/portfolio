# Maya Malavasi Interactive Portfolio - Complete Code Bundle

## Project Structure
```
maya-portfolio/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js (main React app)
│   ├── venn-diagram.js (venn diagram component)
│   └── venn-geometry.js (geometry utilities, currently unused)
└── pages/
    ├── writing.html
    ├── traditional-art.html
    ├── digital-art.html
    └── programming.html
```

---

## FILE: index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maya Malavasi - Interactive Portfolio</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <div id="app"></div>
    
    <!-- React and ReactDOM from CDN -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-router-dom@6.8.0/dist/umd/react-router-dom.production.min.js"></script>
    
    <!-- Venn diagram component -->
    <script src="js/venn-diagram.js"></script>
    
    <!-- Main application -->
    <script src="js/app.js"></script>
</body>
</html>
```

---

## FILE: css/styles.css

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
    overflow: hidden;
    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
    color: #ffffff;
}

#app {
    width: 100vw;
    height: 100vh;
}

/* Canvas Container */
.canvas-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    cursor: grab;
}

.canvas-container.dragging {
    cursor: grabbing;
}

/* Canvas */
.canvas {
    width: 100%;
    height: 100%;
    position: relative;
    transition: transform 0.3s ease-out;
}

/* Nodes */
.node {
    position: absolute;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 3px solid yellow;
    z-index: 100;
}

.node:hover {
    transform: scale(1.1);
    box-shadow: 0 8px 30px rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
}

.node.level-1 {
    width: 180px;
    height: 180px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.8), rgba(139, 92, 246, 0.8));
}

.node.level-2 {
    width: 140px;
    height: 140px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(99, 102, 241, 0.8));
}

.node.level-3 {
    width: 100px;
    height: 100px;
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.8), rgba(59, 130, 246, 0.8));
}

.node-content {
    text-align: center;
    padding: 10px;
    font-weight: 600;
    font-size: 14px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.node.level-1 .node-content {
    font-size: 18px;
}

.node.level-2 .node-content {
    font-size: 16px;
}

.node.level-3 .node-content {
    font-size: 12px;
}

/* Connections */
.connection {
    position: absolute;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
    height: 2px;
    transform-origin: left center;
    pointer-events: none;
    opacity: 0.3;
}

/* Controls */
.controls {
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    gap: 10px;
    z-index: 1000;
}

.control-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
}

.control-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
}

/* Header */
.header {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 1000;
}

.header h1 {
    font-size: 28px;
    font-weight: 700;
    background: linear-gradient(135deg, #fff 0%, #a78bfa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 2px 10px rgba(167, 139, 250, 0.3);
}

.header p {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    margin-top: 5px;
}

/* Breadcrumb */
.breadcrumb {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    padding: 10px 20px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 10px;
}

.breadcrumb-item {
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: color 0.2s ease;
}

.breadcrumb-item:hover {
    color: white;
}

.breadcrumb-separator {
    color: rgba(255, 255, 255, 0.3);
}

/* Loading */
.loading {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
}

.loading-spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: #a78bfa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Image Modal */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    cursor: pointer;
}

.modal-content {
    max-width: 90vw;
    max-height: 90vh;
    cursor: default;
}

.modal-content img {
    max-width: 100%;
    max-height: 90vh;
    border-radius: 8px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-close {
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 18px;
    backdrop-filter: blur(10px);
}
```

---

## FILE: js/app.js

```javascript
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
            const newScale = Math.min(Math.max(scale * delta, 1), 5);
            
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
    const MAX_ZOOM = 5;
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
                        onRegionClick: handleRegionClick
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
```

---

## FILE: js/venn-diagram.js

```javascript
// Venn Diagram Component - Hardcoded 4 Petals

function VennDiagram({ categories, centerX, centerY, size, opacity, textAndBorderOpacity, clickable, onRegionClick }) {
    const width = size * 0.35;
    const length = size * 0.5;
    const ovalCenterDist = length * 0.3;
    const labelDistance = length * 0.525;
    
    const petals = [
        { angle: -Math.PI / 2, color: 'rgba(99, 102, 241, OPACITY)', category: categories[0] },
        { angle: 0, color: 'rgba(236, 72, 153, OPACITY)', category: categories[1] },
        { angle: Math.PI / 2, color: 'rgba(59, 130, 246, OPACITY)', category: categories[2] },
        { angle: Math.PI, color: 'rgba(245, 158, 11, OPACITY)', category: categories[3] }
    ];
    
    const elements = [];
    
    petals.forEach((petal, idx) => {
        const ovalCx = centerX + Math.cos(petal.angle) * ovalCenterDist;
        const ovalCy = centerY + Math.sin(petal.angle) * ovalCenterDist;
        
        const labelX = centerX + Math.cos(petal.angle) * labelDistance;
        const labelY = centerY + Math.sin(petal.angle) * labelDistance;
        
        const rx = width / 2;
        const ry = length / 2;
        const rotation = (petal.angle * 180 / Math.PI) + 90;
        
        const fillColor = petal.color.replace('OPACITY', 0.65);
        
        elements.push(React.createElement('ellipse', {
            key: `oval-${idx}`,
            cx: ovalCx,
            cy: ovalCy,
            rx: rx,
            ry: ry,
            transform: `rotate(${rotation} ${ovalCx} ${ovalCy})`,
            fill: fillColor,
            style: { 
                stroke: `rgba(255, 255, 255, ${0.25 * (textAndBorderOpacity !== undefined ? textAndBorderOpacity : 1)})`,
                strokeWidth: '2px',
                cursor: clickable ? 'pointer' : 'default', 
                mixBlendMode: 'multiply', 
                transition: 'stroke 0.3s ease', 
                pointerEvents: clickable ? 'auto' : 'none' 
            },
            onClick: (e) => { 
                e.stopPropagation(); 
                if (clickable && onRegionClick) onRegionClick({ type: 'single', index: idx, category: petal.category }, { x: labelX, y: labelY }); 
            },
            onMouseEnter: (e) => { 
                if (clickable) {
                    e.currentTarget.style.strokeWidth = '4'; 
                    e.currentTarget.style.stroke = `rgba(255, 255, 255, ${(textAndBorderOpacity || 1) * 0.6})`; 
                } 
            },
            onMouseLeave: (e) => { 
                e.currentTarget.style.strokeWidth = '2'; 
                e.currentTarget.style.stroke = `rgba(255, 255, 255, ${(textAndBorderOpacity || 1) * 0.25})`; 
            }
        }));
        
        elements.push(React.createElement('text', {
            key: `label-${idx}`,
            x: labelX,
            y: labelY,
            style: { 
                fill: `rgba(255, 255, 255, ${textAndBorderOpacity !== undefined ? textAndBorderOpacity : 1})`, 
                fontSize: '24px', 
                fontWeight: 'bold', 
                textAnchor: 'middle', 
                dominantBaseline: 'middle', 
                pointerEvents: 'none', 
                userSelect: 'none', 
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)', 
                transition: 'fill 0.3s ease',
                opacity: textAndBorderOpacity !== undefined ? textAndBorderOpacity : 1
            }
        }, petal.category.name));
    });
    
    return React.createElement('g', { key: 'venn-diagram' }, elements);
}

if (typeof window !== 'undefined') {
    window.VennDiagram = VennDiagram;
}
```

---

## FILE: js/venn-geometry.js

```javascript
// Overlapping Oval Venn Diagram (Flower Shape)

function generateOvalPath(centerX, centerY, angle, width, length) {
    const ovalCenterDist = length * 0.3;
    const ovalCenterX = centerX + Math.cos(angle) * ovalCenterDist;
    const ovalCenterY = centerY + Math.sin(angle) * ovalCenterDist;
    
    const radiusX = width / 2;
    const radiusY = length / 2;
    
    const rotationDeg = (angle * 180 / Math.PI) + 90;
    
    return {
        cx: ovalCenterX,
        cy: ovalCenterY,
        rx: radiusX,
        ry: radiusY,
        rotation: rotationDeg
    };
}

function calculateOvalShapes(centerX, centerY, baseSize) {
    const width = baseSize * 0.35;
    const length = baseSize * 0.5;
    
    return [
        { 
            angle: -Math.PI / 2,
            centerX: centerX,
            centerY: centerY,
            width: width,
            length: length,
            index: 0
        },
        { 
            angle: 0,
            centerX: centerX,
            centerY: centerY,
            width: width,
            length: length,
            index: 1
        },
        { 
            angle: Math.PI / 2,
            centerX: centerX,
            centerY: centerY,
            width: width,
            length: length,
            index: 2
        },
        { 
            angle: Math.PI,
            centerX: centerX,
            centerY: centerY,
            width: width,
            length: length,
            index: 3
        }
    ];
}

function calculateLabelPosition(oval, centerX, centerY) {
    const { angle, length } = oval;
    const labelDistance = length * 0.525;
    
    return {
        x: centerX + Math.cos(angle) * labelDistance,
        y: centerY + Math.sin(angle) * labelDistance
    };
}

function calculateOvalCenter(oval, centerX, centerY) {
    const { angle, length } = oval;
    const centerDistance = length * 0.4;
    
    return {
        cx: centerX + Math.cos(angle) * centerDistance,
        cy: centerY + Math.sin(angle) * centerDistance
    };
}

if (typeof window !== 'undefined') {
    window.VennGeometry = {
        calculateOvalShapes,
        generateOvalPath,
        calculateLabelPosition,
        calculateOvalCenter
    };
}
```

---

## Category Page Files

### FILE: pages/writing.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Writing - Maya Malavasi</title>
    <link rel="stylesheet" href="../css/styles.css">
    <style>
        body {
            background: rgb(99, 102, 241);
            animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    </style>
</head>
<body>
    <div id="app"></div>
    
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    
    <script src="../js/category-page.js"></script>
    <script>
        const pageData = {
            categoryName: 'Writing',
            color: 'rgb(99, 102, 241)',
            subcategories: ['Photography', 'Videography', 'Music', 'Sound Design', 'Editing', 'Storytelling', 'Composition', 'Color Grading']
        };
        const root = ReactDOM.createRoot(document.getElementById('app'));
        root.render(React.createElement(CategoryPage, pageData));
    </script>
</body>
</html>
```

### FILE: pages/traditional-art.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Traditional Art - Maya Malavasi</title>
    <link rel="stylesheet" href="../css/styles.css">
    <style>
        body {
            background: rgb(236, 72, 153);
            animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    </style>
</head>
<body>
    <div id="app"></div>
    
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    
    <script src="../js/category-page.js"></script>
    <script>
        const pageData = {
            categoryName: 'Traditional Art',
            color: 'rgb(236, 72, 153)',
            subcategories: ['Watercolor', 'Acrylics', 'Charcoal', 'Pencil', 'Ink', 'Pastels', 'Oil Paint', 'Gouache']
        };
        const root = ReactDOM.createRoot(document.getElementById('app'));
        root.render(React.createElement(CategoryPage, pageData));
    </script>
</body>
</html>
```

### FILE: pages/digital-art.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Art - Maya Malavasi</title>
    <link rel="stylesheet" href="../css/styles.css">
    <style>
        body {
            background: rgb(59, 130, 246);
            animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    </style>
</head>
<body>
    <div id="app"></div>
    
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    
    <script src="../js/category-page.js"></script>
    <script>
        const pageData = {
            categoryName: 'Digital Art',
            color: 'rgb(59, 130, 246)',
            subcategories: ['Illustration', '3D Modeling', 'UI/UX', 'Animation', 'Concept Art', 'Graphic Design', 'Photo Editing', 'Digital Painting']
        };
        const root = ReactDOM.createRoot(document.getElementById('app'));
        root.render(React.createElement(CategoryPage, pageData));
    </script>
</body>
</html>
```

### FILE: pages/programming.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Programming - Maya Malavasi</title>
    <link rel="stylesheet" href="../css/styles.css">
    <style>
        body {
            background: rgb(245, 158, 11);
            animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    </style>
</head>
<body>
    <div id="app"></div>
    
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    
    <script src="../js/category-page.js"></script>
    <script>
        const pageData = {
            categoryName: 'Programming',
            color: 'rgb(245, 158, 11)',
            subcategories: ['React', 'Python', 'JavaScript', 'TypeScript', 'Node.js', 'Django', 'APIs', 'Docker', 'Git']
        };
        const root = ReactDOM.createRoot(document.getElementById('app'));
        root.render(React.createElement(CategoryPage, pageData));
    </script>
</body>
</html>
```

---

## Key Technical Details

**Technologies:**
- React 18 (via CDN)
- Vanilla CSS with glassmorphism effects
- SVG for Venn diagram rendering
- No build tools required (runs directly in browser)

**Features:**
- Mouse wheel zoom (1x–5x range)
- Smooth pan and drag with momentum/inertia
- Text and border opacity fade with zoom
- Petal clickability disabled at 50% zoom
- URL hash tracking for category navigation
- Clean reset button that clears zoom, pan, and URL hash

**Browser Support:**
- Modern browsers with ES6+ support
- CSS Grid, Flexbox, backdrop-filter support required
