precision highp float;

attribute vec2 aUV;
attribute vec2 aPosition;

varying vec2 vUV;
varying vec2 vPosition;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uDepthStart;

void main() {
    vUV = aUV;
    vPosition = aPosition;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clip = mvp * vec3(
        aPosition.x,
        aPosition.y,
        1.0
    );

    gl_Position = vec4(
        clip.xy,
        uDepthStart,
        1.0
    );
}
