precision mediump float;

attribute vec2 aPosition;
attribute vec2 aUV;
attribute float aZAlongY;
attribute vec3 aInstancePosition;
attribute float aInstanceHighlight;

varying vec2 vPosition;
varying vec2 vUV;
varying float vZAlongY;
varying float vInstanceHighlight;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uAnchorX;
uniform float uAnchorY;
uniform float uTextureHeight;
uniform float uZScale;
uniform float uZOffset;

void main() {
    vUV = aUV;
    vPosition = aPosition;
    vZAlongY = aZAlongY;
    vInstanceHighlight = aInstanceHighlight;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clip = mvp * vec3(
        aInstancePosition.x + aPosition.x - uAnchorX,
        aInstancePosition.y - aInstancePosition.z + aPosition.y - uAnchorY,
        1.0
    );
    
    gl_Position = vec4(
        clip.xy,
        (aInstancePosition.y + uZOffset - (uTextureHeight - aPosition.y) * aZAlongY) * uZScale,
        1.0
    );
}
