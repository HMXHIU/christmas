precision mediump float;

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

void main() {    
    vec2 anchor = vec2(uCx, uCy);
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clip = mvp * vec3(aPosition + aInstancePosition.xy - anchor, 1.0);
    gl_Position = vec4(clip.xy, 0, 1.0);
    vUV = aUV;
    vPosition = aPosition;
}
