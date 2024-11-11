export { masks, tints };

// Used when mixing colors (uses alpha as the amount of influence)
const tints = {
    none: new Float32Array([0, 0, 0, 0]),
    black: new Float32Array([0.1, 0.1, 0.1, 0.85]),
};

// Used when masking/replacing colors (when alpha > 0, mask value replaces the color)
const masks = {
    shadow: new Float32Array([0.25, 0.25, 0.25, 0.5]),
};
