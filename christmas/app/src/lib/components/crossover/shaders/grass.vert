attribute vec2 aPosition;
attribute vec2 aInstancePosition;
attribute vec2 aUV;

varying vec2 vPosition;
varying vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

uniform float uCx;
uniform float uCy;

// uniform float uSkewX
// uniform float uSkewY

// uniform skews {
//     float uSkewX;
//     float uSkewY;
// };


void main() {


    // Create a skew transformation matrix
    mat3 skewMatrix = mat3(
        1.0, 0.3, 0.0,
        0.7, 1.0, 0.0,
        0.0, 0.0, 1.0
    );

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix; 
    gl_Position = vec4((mvp * vec3(aPosition + aInstancePosition.xy - vec2(uCx, uCy), 1.0)).xy, 0, 1.0);
    vUV = aUV;
    vPosition = aPosition;
}
