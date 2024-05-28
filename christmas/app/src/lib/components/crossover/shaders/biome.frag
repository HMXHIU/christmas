precision mediump float;

varying vec2 vUV;
varying vec2 vPosition;
varying vec3 vInstancePosition;

uniform sampler2D uTexture;
uniform float uTextureHeight;
uniform float uTextureWidth;

void main() {

    if (vInstancePosition.x < 0.0) {
        discard;
    }

    vec4 color = texture2D(uTexture, vUV);

    // Discard the fragment if alpha is 0
    if (color.a < 0.1) {
        discard;
    }

    gl_FragColor = color;
}

