precision mediump float;

attribute vec2 aPosition;
attribute vec2 aUV;
attribute vec3 aInstancePosition;

varying vec2 vPosition;
varying vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uDepthFactor;
uniform float uAnchorX;
uniform float uAnchorY;
uniform float uTextureHeight;

void main() {
    vUV = aUV;
    vPosition = aPosition;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clip = mvp * vec3(aPosition - vec2(uAnchorX, uAnchorY), 1.0);
    float zAlongY = (uTextureHeight - aPosition.y) * uDepthFactor;
    gl_Position = vec4(clip.xy, aInstancePosition.z - zAlongY, 1.0);
}
