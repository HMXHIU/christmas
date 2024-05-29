precision mediump float;

varying vec2 vUV;
varying vec2 vPosition;

uniform sampler2D uTexture;
uniform float uTextureHeight;
uniform float uTextureWidth;

void main() {

    vec4 color = texture2D(uTexture, vUV);

    // Discard the fragment if alpha is 0
    if (color.a < 0.1) {
        discard;
    }

    gl_FragColor = color;
}

