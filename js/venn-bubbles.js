// Venn Diagram Bubbles - Per-Region Subnode Circles
//
// Each Venn region gets one bubble per image whose tags place it in exactly
// that region (see buildRegionImageMap below). Regions with no matching
// images render no bubbles at all. Bubbles are invisible at full zoom out
// and fade in alongside the region labels, and are only clickable once
// they've faded in.

const BUBBLE_FADE_START = 0.3;
const BUBBLE_FADE_END = 0.5;

// Fixed so every bubble displays at the same size, regardless of its
// region's area. Still divided by scale^0.4 at render time (same
// counter-scaling used for label text) to stay visually consistent as the
// user zooms in and out.
const BUBBLE_RADIUS = 10;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Vogel's model, adapted to an annulus: distributes `count` points evenly
// across the ring between innerRadius and outerRadius (area-uniform, not
// radius-uniform) without randomness, so bubble layout stays stable across
// re-renders. innerRadius keeps points clear of the region's own label.
function calculateBubblePositions(centroid, innerRadius, outerRadius, count) {
    const positions = [];
    for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const r = Math.sqrt(innerRadius * innerRadius + t * (outerRadius * outerRadius - innerRadius * innerRadius));
        const theta = i * GOLDEN_ANGLE;
        positions.push({
            x: centroid.x + Math.cos(theta) * r,
            y: centroid.y + Math.sin(theta) * r
        });
    }
    return positions;
}

// If `point` falls inside the exclusion disc (used to keep bubbles clear of
// the central 4-way overlap region), pushes it radially outward from the
// exclusion's own center until it just clears the boundary.
function pushOutsideExclusion(point, exclusion) {
    if (!exclusion) return point;

    const dx = point.x - exclusion.x;
    const dy = point.y - exclusion.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= exclusion.radius) return point;

    const ux = dist > 1e-6 ? dx / dist : 1;
    const uy = dist > 1e-6 ? dy / dist : 0;
    return {
        x: exclusion.x + ux * exclusion.radius,
        y: exclusion.y + uy * exclusion.radius
    };
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
function renderRegionBubbles({ regionIdx, region, scale = 1, images, zoomProgress, fallbackColor, onBubbleClick, labelRadius = 0, centerExclusion = null }) {
    if (!images || images.length === 0) return [];

    const opacity = Math.max(0, Math.min(1,
        (zoomProgress - BUBBLE_FADE_START) / (BUBBLE_FADE_END - BUBBLE_FADE_START)
    ));
    if (opacity <= 0) return [];

    const { centroid, area } = region;
    const bubbleRadius = BUBBLE_RADIUS / Math.pow(scale, 0.4);

    // Inner edge keeps bubbles clear of the region's own centered label.
    // Outer edge normally tracks the region's own size, but if the label is
    // too big (or there are too many bubbles) to fit inside it, it's allowed
    // to grow past the region's own border rather than overlap the text.
    const innerRadius = labelRadius + bubbleRadius * 0.5;
    const naturalOuterRadius = Math.max(bubbleRadius * 1.5, Math.sqrt(area / Math.PI) * 0.55 - bubbleRadius);
    const ringsNeeded = Math.ceil(Math.sqrt(images.length));
    const minSpreadOuterRadius = innerRadius + bubbleRadius * 2 * ringsNeeded;
    const outerRadius = Math.max(naturalOuterRadius, minSpreadOuterRadius, innerRadius + bubbleRadius);

    const positions = calculateBubblePositions(centroid, innerRadius, outerRadius, images.length)
        .map(pos => pushOutsideExclusion(pos, centerExclusion));

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
            'data-image-id': image.id,
            'data-region-mask': region.mask,
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
