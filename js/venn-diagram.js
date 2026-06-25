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
