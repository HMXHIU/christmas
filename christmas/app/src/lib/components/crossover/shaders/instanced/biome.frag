precision highp float;

varying vec2 vUV;
varying float vInstanceHighlight;

uniform sampler2D uTexture;

void main() {

    vec4 color = texture2D(uTexture, vUV);

    // Discard the fragment if alpha is 0
    if (color.a < 0.1) {
        discard;
    }

    if (vInstanceHighlight > 1.0) {
        color *= vec4(0.5, 1.0, 0.5, 1.0);
    }
    else if (vInstanceHighlight > 0.0) {
        color *= vec4(1.0, 0.5, 0.5, 1.0);
    }

    gl_FragColor = color;
}

