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


void main() {
    vUV = aUV;
    vPosition = aPosition;
    vInstancePosition = aInstancePosition;

    vec2 anchor = vec2(uCx, uCy);
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clip = mvp * vec3(aPosition + aInstancePosition.xy - anchor, 1.0);
    gl_Position = vec4(clip.xy, aInstancePosition.z, 1.0);
}
