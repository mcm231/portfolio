// Venn Diagram Component - Hardcoded 4 Petals, Separately Clickable Regions
//
// Every region of the 4-petal arrangement (single petals, pairwise overlaps,
// triple overlaps, and the center quad overlap) is computed as its own
// polygon via VennGeometry.calculateVennRegions, then rendered as its own
// shape. Regions that include more than one petal are drawn as N stacked
// identical paths (one per contributing petal color) with mix-blend-mode:
// multiply, so the color blend still looks like real overlapping petals even
// though each region is now a separate, independently clickable shape.

const PETAL_COLORS = [
    'rgba(99, 102, 241, OPACITY)',
    'rgba(236, 72, 153, OPACITY)',
    'rgba(59, 130, 246, OPACITY)',
    'rgba(245, 158, 11, OPACITY)'
];

const MULTI_PETAL_LABEL_FADE_START = 0.5;
const MULTI_PETAL_LABEL_FADE_END = 0.75;

function VennDiagram({ categories, centerX, centerY, size, opacity, textAndBorderOpacity, clickable, onRegionClick, onBubbleClick, scale = 1, zoomProgress = 0 }) {
    const regions = React.useMemo(
        () => window.VennGeometry.calculateVennRegions(centerX, centerY, size, categories.length),
        [centerX, centerY, size, categories.length]
    );

    const placeholderImageUrl = window.VennBubbles.usePlaceholderImageUrl();

    const maxArea = regions.reduce((max, r) => Math.max(max, r.area), 1);
    const elements = [];

    regions.forEach((region, regionIdx) => {
        const { included, pathD, centroid, area } = region;
        const includedCategories = included.map(idx => categories[idx]);
        const label = includedCategories.map(c => c.name).join(' ∩ ');

        const strokeOpacity = 0.25 * (textAndBorderOpacity !== undefined ? textAndBorderOpacity : 1);
        const hoverStrokeOpacity = (textAndBorderOpacity !== undefined ? textAndBorderOpacity : 1) * 0.6;

        included.forEach((petalIdx, layerIdx) => {
            const isTopLayer = layerIdx === included.length - 1;
            const fillColor = PETAL_COLORS[petalIdx].replace('OPACITY', 0.65);

            elements.push(React.createElement('path', {
                key: `region-${regionIdx}-layer-${layerIdx}`,
                d: pathD,
                fill: fillColor,
                style: {
                    stroke: isTopLayer ? `rgba(255, 255, 255, ${strokeOpacity})` : 'none',
                    strokeWidth: '2px',
                    cursor: clickable ? 'pointer' : 'default',
                    mixBlendMode: 'multiply',
                    transition: 'stroke 0.3s ease',
                    pointerEvents: isTopLayer ? (clickable ? 'auto' : 'none') : 'none'
                },
                onClick: isTopLayer ? (e) => {
                    e.stopPropagation();
                    if (clickable && onRegionClick) {
                        onRegionClick({ included, categories: includedCategories, label }, centroid);
                    }
                } : undefined,
                onMouseEnter: isTopLayer ? (e) => {
                    if (clickable) {
                        e.currentTarget.style.strokeWidth = '4';
                        e.currentTarget.style.stroke = `rgba(255, 255, 255, ${hoverStrokeOpacity})`;
                    }
                } : undefined,
                onMouseLeave: isTopLayer ? (e) => {
                    e.currentTarget.style.strokeWidth = '2';
                    e.currentTarget.style.stroke = `rgba(255, 255, 255, ${strokeOpacity})`;
                } : undefined
            }));
        });

        const isMultiPetal = included.length >= 2;
        const multiPetalLabelOpacity = Math.max(0, Math.min(1,
            (zoomProgress - MULTI_PETAL_LABEL_FADE_START) / (MULTI_PETAL_LABEL_FADE_END - MULTI_PETAL_LABEL_FADE_START)
        ));
        if (isMultiPetal && multiPetalLabelOpacity <= 0) return;

        const baseFontSize = Math.max(8, Math.min(17, 17 * Math.sqrt(area / maxArea))) / Math.pow(scale, 0.4);
        const fontSize = isMultiPetal ? baseFontSize * 0.7 : baseFontSize;

        elements.push(React.createElement('text', {
            key: `label-${regionIdx}`,
            x: centroid.x,
            y: centroid.y,
            style: {
                fill: 'rgba(255, 255, 255, 1)',
                fontSize: `${fontSize}px`,
                fontWeight: 'bold',
                textAnchor: 'middle',
                dominantBaseline: 'middle',
                pointerEvents: 'none',
                userSelect: 'none',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
                opacity: isMultiPetal ? multiPetalLabelOpacity : 1,
                transition: 'opacity 0.2s ease'
            }
        }, label));

        const fallbackColor = PETAL_COLORS[included[included.length - 1]].replace('OPACITY', 0.5);
        elements.push(...window.VennBubbles.renderRegionBubbles({
            regionIdx,
            region,
            maxArea,
            scale,
            imageUrl: placeholderImageUrl,
            zoomProgress,
            fallbackColor,
            onBubbleClick
        }));
    });

    return React.createElement('g', { key: 'venn-diagram' }, elements);
}

if (typeof window !== 'undefined') {
    window.VennDiagram = VennDiagram;
}
