// Venn Diagram Bubbles - Per-Region Subnode Circles
//
// Each Venn region gets a small cluster of "bubble" nodes scattered around
// its centroid, each showing an image. Bubbles are invisible at full zoom
// out and fade in alongside the region labels (50%-75% zoom), and are only
// clickable once they've faded in.

// Number of bubbles rendered per region. Will eventually be driven by a
// per-region database query; hardcoded for now to focus on node construction.
const NUM_SUBNODES = 5;

const BUBBLE_FADE_START = 0.3;
const BUBBLE_FADE_END = 0.5;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Vogel's model: distributes `count` points evenly across a disc without
// randomness, so bubble layout stays stable across re-renders.
function calculateBubblePositions(centroid, maxRadius, count) {
    const positions = [];
    for (let i = 0; i < count; i++) {
        const r = maxRadius * Math.sqrt((i + 0.5) / count);
        const theta = i * GOLDEN_ANGLE;
        positions.push({
            x: centroid.x + Math.cos(theta) * r,
            y: centroid.y + Math.sin(theta) * r
        });
    }
    return positions;
}

// Fetches image metadata once and resolves to a URL for the first available
// image, used as a placeholder for every bubble until real per-image data
// is wired up.
function usePlaceholderImageUrl() {
    const [url, setUrl] = React.useState(null);

    React.useEffect(() => {
        fetch('/api/image-metadata')
            .then(res => res.ok ? res.json() : [])
            .then(entries => {
                if (Array.isArray(entries) && entries.length > 0) {
                    setUrl(`/api/images?id=${encodeURIComponent(entries[0].id)}`);
                }
            })
            .catch(() => {});
    }, []);

    return url;
}

// Renders the bubble cluster for a single region. Returns an array of React
// elements (clipPath defs + bubble groups) to splice into the parent <g>.
function renderRegionBubbles({ regionIdx, region, maxArea, scale = 1, imageUrl, zoomProgress, fallbackColor, onBubbleClick }) {
    const opacity = Math.max(0, Math.min(1,
        (zoomProgress - BUBBLE_FADE_START) / (BUBBLE_FADE_END - BUBBLE_FADE_START)
    ));
    if (opacity <= 0) return [];

    const { centroid, area } = region;
    const bubbleRadius = Math.max(4, Math.min(16, 16 * Math.sqrt(area / maxArea))) / Math.pow(scale, 0.4);
    const spiralMaxRadius = Math.max(bubbleRadius * 1.5, Math.sqrt(area / Math.PI) * 0.55 - bubbleRadius);
    const positions = calculateBubblePositions(centroid, spiralMaxRadius, NUM_SUBNODES);

    const elements = [];

    positions.forEach((pos, bubbleIdx) => {
        const clipId = `bubble-clip-${regionIdx}-${bubbleIdx}`;

        elements.push(React.createElement('clipPath', { key: clipId, id: clipId },
            React.createElement('circle', { cx: pos.x, cy: pos.y, r: bubbleRadius })
        ));

        elements.push(React.createElement('g', {
            key: `bubble-${regionIdx}-${bubbleIdx}`,
            style: {
                opacity,
                transition: 'opacity 0.2s ease',
                pointerEvents: opacity > 0 ? 'auto' : 'none',
                cursor: opacity > 0 ? 'pointer' : 'default'
            },
            onClick: (e) => {
                e.stopPropagation();
                if (opacity > 0 && onBubbleClick) onBubbleClick(region, bubbleIdx);
            }
        }, [
            imageUrl
                ? React.createElement('image', {
                    key: 'image',
                    href: imageUrl,
                    x: pos.x - bubbleRadius,
                    y: pos.y - bubbleRadius,
                    width: bubbleRadius * 2,
                    height: bubbleRadius * 2,
                    preserveAspectRatio: 'xMidYMid slice',
                    clipPath: `url(#${clipId})`
                })
                : React.createElement('circle', {
                    key: 'fallback',
                    cx: pos.x,
                    cy: pos.y,
                    r: bubbleRadius,
                    fill: fallbackColor
                }),
            React.createElement('circle', {
                key: 'border',
                cx: pos.x,
                cy: pos.y,
                r: bubbleRadius,
                fill: 'none',
                stroke: 'rgba(255, 255, 255, 0.7)',
                strokeWidth: 1.5
            })
        ]));
    });

    return elements;
}

if (typeof window !== 'undefined') {
    window.VennBubbles = {
        NUM_SUBNODES,
        BUBBLE_FADE_START,
        BUBBLE_FADE_END,
        calculateBubblePositions,
        usePlaceholderImageUrl,
        renderRegionBubbles
    };
}
