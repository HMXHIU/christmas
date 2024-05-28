precision mediump float;

attribute vec2 aPosition;
attribute vec3 aInstancePosition;
attribute vec2 aUV;

varying vec2 vPosition;
varying vec2 vUV;
varying vec3 vInstancePosition;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

uniform float uCx;
uniform float uCy;
uniform float uTextureHeight;
uniform float uTextureWidth;
uniform float uTime;

// uniform float uSkewX
// uniform float uSkewY

// uniform skews {
//     float uSkewX;
//     float uSkewY;
// };

// Function to create a 2D rotation matrix
mat2 rotationMatrix(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

void main() {

    // Create a skew transformation matrix
    mat3 skewMatrix = mat3(
        1.0, 0.3, 0.0,
        0.7, 1.0, 0.0,
        0.0, 0.0, 1.0
    );
    
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;

    vec2 anchor = vec2(uCx, uCy);

    // Calculate clip space coordinates
    vec3 clip = mvp * vec3(aPosition + aInstancePosition.xy - anchor, 1.0);

    // Map clip space coordinates to [0, 1] range for noise sampling
    vec2 st = remap(clip.xy, vec2(-1, -1), vec2(1, 1), vec2(0, 0), vec2(1, 1));

    // Sample noise to get the wind effect
    float noiseSample = snoise(vec2(st * 2. + uTime)) * 0.05;

    // Calculate the height factor (1.0 at the base, 0.0 at the top)
    float percentHeight = (uTextureHeight - aPosition.y) / uTextureHeight;

    // Compute the rotation angle based on noise and height factor
    float angle = noiseSample * percentHeight;

    gl_Position = vec4(rotationMatrix(angle) * clip.xy, aInstancePosition.z, 1.0);
    vUV = aUV;
    vPosition = aPosition;
    vInstancePosition = aInstancePosition;
}
