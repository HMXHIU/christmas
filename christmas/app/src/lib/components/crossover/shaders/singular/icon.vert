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
varying vec3 vInstancePosition;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uTextureHeight;
uniform float uZScale;
uniform float uZOffset;

void main() {
    vUV = aUV;
    vPosition = aPosition;
    vZAlongY = aZAlongY;
    vInstanceHighlight = aInstanceHighlight;
    vInstancePosition = aInstancePosition;

    // Icon positions are set in mesh.position not via instancePosition
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clip = mvp * vec3(
        aPosition.x,
        aPosition.y,
        1.0
    );

    gl_Position = vec4(
        clip.xy,
        0.1, // Icons are always in front ???
        1.0
    );
}
