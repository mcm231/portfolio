// Overlapping Oval Venn Diagram (Flower Shape)
// Computes the 4 base petal ovals, then derives every non-empty
// intersection/difference region between them (15 possible regions for
// 4 sets) so each region can be its own clickable, zoomable shape.

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
        { angle: -Math.PI / 2, centerX, centerY, width, length, index: 0 },
        { angle: 0, centerX, centerY, width, length, index: 1 },
        { angle: Math.PI / 2, centerX, centerY, width, length, index: 2 },
        { angle: Math.PI, centerX, centerY, width, length, index: 3 }
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

// --- Polygon approximation of an ellipse, for boolean region math ---

function ellipseToPolygon(cx, cy, rx, ry, rotationDeg, segments = 96) {
    const rotationRad = rotationDeg * Math.PI / 180;
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);
    const points = [];

    for (let i = 0; i < segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const ex = rx * Math.cos(theta);
        const ey = ry * Math.sin(theta);
        points.push([
            cx + ex * cosR - ey * sinR,
            cy + ex * sinR + ey * cosR
        ]);
    }
    return points;
}

function toPolyBoolPoly(points) {
    return { regions: [points], inverted: false };
}

// Shoelace formula: signed area and area-weighted centroid of a simple polygon.
function polygonCentroid(points) {
    let area = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        const cross = x1 * y2 - x2 * y1;
        area += cross;
        cx += (x1 + x2) * cross;
        cy += (y1 + y2) * cross;
    }

    area /= 2;

    if (Math.abs(area) < 1e-9) {
        const n = points.length || 1;
        const sum = points.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
        return { x: sum[0] / n, y: sum[1] / n, area: 0 };
    }

    return { x: cx / (6 * area), y: cy / (6 * area), area: Math.abs(area) };
}

function polygonToPathD(regions) {
    return regions
        .map(points => {
            if (points.length < 3) return '';
            const [first, ...rest] = points;
            return `M ${first[0]} ${first[1]} ` +
                rest.map(([x, y]) => `L ${x} ${y}`).join(' ') + ' Z';
        })
        .filter(Boolean)
        .join(' ');
}

// Computes every non-empty region formed by intersecting a subset of the
// petals and subtracting the remaining petals (i.e. the true Venn cells).
function calculateVennRegions(centerX, centerY, baseSize, petalCount = 4) {
    const PolyBool = typeof window !== 'undefined' ? window.PolyBool : null;
    if (!PolyBool) {
        throw new Error('PolyBool library not loaded; cannot compute Venn regions.');
    }

    const shapes = calculateOvalShapes(centerX, centerY, baseSize);
    const petalPolygons = shapes.map(shape => {
        const { cx, cy, rx, ry, rotation } = generateOvalPath(
            shape.centerX, shape.centerY, shape.angle, shape.width, shape.length
        );
        return ellipseToPolygon(cx, cy, rx, ry, rotation);
    });

    const minArea = baseSize * baseSize * 0.00015;
    const regions = [];

    for (let mask = 1; mask < (1 << petalCount); mask++) {
        const included = [];
        const excluded = [];
        for (let i = 0; i < petalCount; i++) {
            if (mask & (1 << i)) included.push(i);
            else excluded.push(i);
        }

        let acc = toPolyBoolPoly(petalPolygons[included[0]]);
        for (let k = 1; k < included.length; k++) {
            acc = PolyBool.intersect(acc, toPolyBoolPoly(petalPolygons[included[k]]));
            if (!acc.regions.length) break;
        }
        for (const idx of excluded) {
            if (!acc.regions.length) break;
            acc = PolyBool.difference(acc, toPolyBoolPoly(petalPolygons[idx]));
        }

        const subRegions = acc.regions.filter(pts => pts.length >= 3);
        if (!subRegions.length) continue;

        let best = null;
        let totalArea = 0;
        subRegions.forEach(pts => {
            const c = polygonCentroid(pts);
            totalArea += c.area;
            if (!best || c.area > best.area) best = c;
        });

        if (totalArea < minArea || !best) continue;

        regions.push({
            mask,
            included,
            pathD: polygonToPathD(subRegions),
            centroid: { x: best.x, y: best.y },
            area: totalArea
        });
    }

    return regions;
}

if (typeof window !== 'undefined') {
    window.VennGeometry = {
        calculateOvalShapes,
        generateOvalPath,
        calculateLabelPosition,
        calculateOvalCenter,
        ellipseToPolygon,
        calculateVennRegions
    };
}
