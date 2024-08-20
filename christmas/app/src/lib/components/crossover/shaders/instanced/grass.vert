precision highp float;

attribute vec3 aInstancePosition;
attribute float aInstanceVertIndex;
attribute vec4 aInstanceXUV;
attribute vec4 aInstanceYUV;
attribute vec2 aInstanceSize;
attribute vec2 aInstanceAnchor;
attribute float aInstanceHighlight;

varying vec2 vPosition;
varying vec2 vUV;
varying vec2 vInstanceSize;
varying float vInstanceHighlight;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uTime;

uniform float uDepthStart;
uniform float uDepthScale;

// Function to create a 2D rotation matrix
mat2 rotationMatrix(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

void main() {

    vInstanceHighlight = aInstanceHighlight;
    vInstanceSize = aInstanceSize;

    int vertIdx = int(aInstanceVertIndex);
    if (vertIdx == 0) {
        vUV = vec2(aInstanceXUV.x, aInstanceYUV.x);
        vPosition = vec2(0, 0);
    } else if (vertIdx == 1) {
        vUV = vec2(aInstanceXUV.y, aInstanceYUV.y);
        vPosition = vec2(aInstanceSize.x, 0);
    } else if (vertIdx == 2) {
        vUV = vec2(aInstanceXUV.z, aInstanceYUV.z);
        vPosition = aInstanceSize;
    } else {
        vUV = vec2(aInstanceXUV.w, aInstanceYUV.w);
        vPosition = vec2(0, aInstanceSize.y);
    }

    // Calculate clip space coordinates
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clip = mvp * vec3(
        aInstancePosition.x + vPosition.x - (aInstanceAnchor.x * aInstanceSize.x),
        aInstancePosition.y - aInstancePosition.z + vPosition.y - (aInstanceAnchor.y * aInstanceSize.y),
        1.0
    );

    // Map clip space coordinates to [0, 1] range for noise sampling
    vec2 st = remap(clip.xy, vec2(-1, -1), vec2(1, 1), vec2(0, 0), vec2(1, 1));

    // Sample noise to get the wind effect
    float windSpeed = 0.02;
    float noiseSample = snoise(vec2(st * 2. + uTime)) * windSpeed;

    // Calculate the height factor (1.0 at the base, 0.0 at the top)
    float percentHeight = (vInstanceSize.y - vPosition.y) / vInstanceSize.y;

    // Compute the rotation angle based on noise and height factor
    float angle = noiseSample * percentHeight;

    gl_Position = vec4(
        rotationMatrix(angle) * clip.xy,
        uDepthStart - (aInstancePosition.y * uDepthScale),
        1.0
    );
}
