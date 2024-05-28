precision mediump float;

varying vec2 vUV;
varying vec2 vPosition;

uniform sampler2D uTexture;
uniform float uTextureHeight;
uniform float uTextureWidth;

void main() {
    gl_FragColor = texture2D(uTexture, vUV);
}

