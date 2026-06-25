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
