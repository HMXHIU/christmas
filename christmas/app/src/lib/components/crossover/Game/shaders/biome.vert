precision mediump float;

attribute vec2 aPosition;
attribute vec3 aInstancePosition;
attribute float aInstanceHighlight;
attribute vec2 aUV;
attribute float aZAlongY;

varying vec2 vPosition;
varying vec2 vUV;
varying float vZAlongY;
varying vec3 vInstancePosition;
varying float vInstanceHighlight;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uAnchorX;
uniform float uAnchorY;
uniform float uTextureHeight;
uniform float uTextureWidth;
uniform float uZScale;
uniform float uZOffset;

void main() {
    vUV = aUV;
    vZAlongY = aZAlongY;
    vPosition = aPosition;
    vInstancePosition = aInstancePosition;
    vInstanceHighlight = aInstanceHighlight;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clip = mvp * vec3(
        aInstancePosition.x + aPosition.x - uAnchorX,
        aInstancePosition.y - aInstancePosition.z + aPosition.y - uAnchorY,
        1.0
    );
    gl_Position = vec4(
        clip.xy,
        (aInstancePosition.y + uZOffset) * uZScale,
        1.0
    );
}
