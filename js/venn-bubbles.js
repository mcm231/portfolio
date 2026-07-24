// Venn Diagram Bubbles - Per-Region Subnode Circles
//
// Each Venn region gets one bubble per image whose tags place it in exactly
// that region (see buildRegionImageMap below). Regions with no matching
// images render no bubbles at all. Bubbles are invisible at full zoom out
// and fade in alongside the region labels, and are only clickable once
// they've faded in.

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

// Module-level cache so the metadata list is fetched at most once per page
// load, no matter how many times the hook below mounts/re-runs.
let imageEntriesRequest = null;

function fetchImageEntriesOnce() {
    if (!imageEntriesRequest) {
        imageEntriesRequest = fetch('/api/image-metadata')
            .then(res => res.ok ? res.json() : [])
            .then(entries => Array.isArray(entries) ? entries : [])
            .catch(() => []);
    }
    return imageEntriesRequest;
}

// Fetches the full image metadata list once on mount (served from cache on
// any subsequent mount) and exposes it as null while loading, then an array.
function useImageEntries() {
    const [entries, setEntries] = React.useState(null);

    React.useEffect(() => {
        let cancelled = false;
        fetchImageEntriesOnce().then(result => {
            if (!cancelled) setEntries(result);
        });
        return () => { cancelled = true; };
    }, []);

    return entries;
}

// Groups image entries by exactly which categories' tags they carry, keyed
// by the same bitmask VennGeometry uses for regions (bit i set = categories[i]
// is one of the tags). An image tagged only "digital-art" maps to the single
// Digital Art region; tagged "digital-art"+"programming" maps to just their
// intersection region, not either petal alone. Images with no tag matching
// any category are dropped (they have no region to appear in).
function buildRegionImageMap(entries, categories) {
    const map = new Map();
    if (!entries) return map;

    const categoryIndexByTag = new Map(categories.map((c, idx) => [c.id, idx]));

    entries.forEach(entry => {
        if (!entry.filename || !Array.isArray(entry.tags)) return;

        let mask = 0;
        entry.tags.forEach(tag => {
            if (categoryIndexByTag.has(tag)) {
                mask |= (1 << categoryIndexByTag.get(tag));
            }
        });
        if (mask === 0) return;

        if (!map.has(mask)) map.set(mask, []);
        map.get(mask).push(entry);
    });

    return map;
}

// Renders the bubble cluster for a single region: one bubble per image in
// `images`. Returns an array of React elements (clipPath defs + bubble
// groups) to splice into the parent <g>, or [] if there's nothing to show.
function renderRegionBubbles({ regionIdx, region, maxArea, scale = 1, images, zoomProgress, fallbackColor, onBubbleClick }) {
    if (!images || images.length === 0) return [];

    const opacity = Math.max(0, Math.min(1,
        (zoomProgress - BUBBLE_FADE_START) / (BUBBLE_FADE_END - BUBBLE_FADE_START)
    ));
    if (opacity <= 0) return [];

    const { centroid, area } = region;
    const bubbleRadius = Math.max(4, Math.min(16, 16 * Math.sqrt(area / maxArea))) / Math.pow(scale, 0.4);
    const spiralMaxRadius = Math.max(bubbleRadius * 1.5, Math.sqrt(area / Math.PI) * 0.55 - bubbleRadius);
    const positions = calculateBubblePositions(centroid, spiralMaxRadius, images.length);

    const elements = [];

    positions.forEach((pos, bubbleIdx) => {
        const image = images[bubbleIdx];
        const imageUrl = `/api/images?id=${encodeURIComponent(image.filename)}`;
        const clipId = `bubble-clip-${regionIdx}-${bubbleIdx}`;

        elements.push(React.createElement('clipPath', { key: clipId, id: clipId },
            React.createElement('circle', { cx: pos.x, cy: pos.y, r: bubbleRadius })
        ));

        elements.push(React.createElement('g', {
            key: `bubble-${regionIdx}-${image.id || bubbleIdx}`,
            style: {
                opacity,
                transition: 'opacity 0.2s ease',
                pointerEvents: opacity > 0 ? 'auto' : 'none',
                cursor: opacity > 0 ? 'pointer' : 'default'
            },
            onClick: (e) => {
                e.stopPropagation();
                if (opacity > 0 && onBubbleClick) onBubbleClick(image, region);
            }
        }, [
            React.createElement('circle', {
                key: 'fallback',
                cx: pos.x,
                cy: pos.y,
                r: bubbleRadius,
                fill: fallbackColor,
                style: { pointerEvents: 'none' }
            }),
            React.createElement('image', {
                key: 'image',
                href: imageUrl,
                x: pos.x - bubbleRadius,
                y: pos.y - bubbleRadius,
                width: bubbleRadius * 2,
                height: bubbleRadius * 2,
                preserveAspectRatio: 'xMidYMid slice',
                clipPath: `url(#${clipId})`,
                onError: (e) => { e.currentTarget.style.display = 'none'; }
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
        BUBBLE_FADE_START,
        BUBBLE_FADE_END,
        calculateBubblePositions,
        useImageEntries,
        buildRegionImageMap,
        renderRegionBubbles
    };
}
