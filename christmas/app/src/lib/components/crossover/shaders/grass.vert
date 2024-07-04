precision mediump float;

attribute vec2 aPosition;
attribute vec3 aInstancePosition;
attribute vec2 aUV;
attribute float aInstanceHighlight;
attribute float aZAlongY;

varying vec2 vPosition;
varying vec2 vUV;
varying float vZAlongY;
varying vec3 vInstancePosition;
varying float vInstanceHighlight;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

uniform float uTextureHeight;
uniform float uTextureWidth;
uniform float uTime;
uniform float uAnchorX;
uniform float uAnchorY;
uniform float uZScale;
uniform float uZOffset;

// Function to create a 2D rotation matrix
mat2 rotationMatrix(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

void main() {
    vUV = aUV;
    vPosition = aPosition;
    vInstancePosition = aInstancePosition;
    vInstanceHighlight = aInstanceHighlight;
    vZAlongY = aZAlongY;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;

    // Calculate clip space coordinates
    vec3 clip = mvp * vec3(
        aInstancePosition.x + aPosition.x - uAnchorX,
        aInstancePosition.y - aInstancePosition.z + aPosition.y - uAnchorY,
        1.0
    );

    // Map clip space coordinates to [0, 1] range for noise sampling
    vec2 st = remap(clip.xy, vec2(-1, -1), vec2(1, 1), vec2(0, 0), vec2(1, 1));

    // Sample noise to get the wind effect
    float windSpeed = 0.02;
    float noiseSample = snoise(vec2(st * 2. + uTime)) * windSpeed;

    // Calculate the height factor (1.0 at the base, 0.0 at the top)
    float percentHeight = (uTextureHeight - aPosition.y) / uTextureHeight;

    // Compute the rotation angle based on noise and height factor
    float angle = noiseSample * percentHeight;

    gl_Position = vec4(
        rotationMatrix(angle) * clip.xy,
        0.5 + (aInstancePosition.y + uZOffset) * uZScale,
        1.0
    );
}
