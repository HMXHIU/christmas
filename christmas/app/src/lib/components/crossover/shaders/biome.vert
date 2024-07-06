precision mediump float;

attribute vec3 aInstancePosition;
attribute float aInstanceHighlight;
attribute float aInstanceVertIndex;
attribute vec4 aInstanceXUV;
attribute vec4 aInstanceYUV;
attribute vec2 aInstanceSize;
attribute vec2 aInstanceAnchor;

varying vec2 vPosition;
varying vec2 vUV;
varying vec3 vInstancePosition;
varying float vInstanceHighlight;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uZScale;
uniform float uZOffset;

void main() {
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
    vInstancePosition = aInstancePosition;
    vInstanceHighlight = aInstanceHighlight;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clip = mvp * vec3(
        aInstancePosition.x + vPosition.x - (aInstanceAnchor.x * aInstanceSize.x),
        aInstancePosition.y - aInstancePosition.z + vPosition.y - (aInstanceAnchor.y * aInstanceSize.y),
        1.0
    );
    gl_Position = vec4(
        clip.xy,
        0.5 + (aInstancePosition.y + uZOffset) * uZScale,
        1.0
    );
}
