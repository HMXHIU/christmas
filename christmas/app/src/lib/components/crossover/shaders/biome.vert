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
uniform float uAnchorX;
uniform float uAnchorY;
uniform float uTextureHeight;
uniform float uDepthFactor;

void main() {
    vUV = aUV;
    vPosition = aPosition;
    vInstancePosition = aInstancePosition;

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec3 clip = mvp * vec3(aPosition + aInstancePosition.xy - vec2(uAnchorX, uAnchorY), 1.0);
    
    gl_Position = vec4(clip.xy, aInstancePosition.z, 1.0);
}
