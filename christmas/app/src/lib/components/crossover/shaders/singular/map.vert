precision highp float;

attribute vec2 aPosition;
attribute vec2 aUV;
attribute float aZAlongY;
attribute vec3 aInstancePosition;
attribute float aInstanceHighlight;

varying vec2 vPosition;
varying vec2 vUV;
varying float vZAlongY;
varying float vInstanceHighlight;
varying vec3 vInstancePosition;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
    vUV = aUV;
    vPosition = aPosition;
    vZAlongY = aZAlongY;
    vInstanceHighlight = aInstanceHighlight;
    vInstancePosition = aInstancePosition;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4(
        (mvp * vec3(aPosition, 1.0)).xy,
        0,
        1.0
    );
}