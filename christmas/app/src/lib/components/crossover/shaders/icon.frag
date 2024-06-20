precision mediump float;

varying vec2 vUV;
varying vec2 vPosition;
varying float vInstanceHighlight;

uniform sampler2D uTexture;
uniform float uTextureHeight;
uniform float uTextureWidth;

void main() {

    vec4 color = texture2D(uTexture, vUV);

    if (vInstanceHighlight > 0.0) {
        color *= vec4(1, 0.5, 0.5, 1.0);
    }

    gl_FragColor = color;
}

