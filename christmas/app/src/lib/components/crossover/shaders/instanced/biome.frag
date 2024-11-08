precision highp float;

varying vec2 vUV;
varying float vInstanceHighlight;

uniform sampler2D uTexture;

void main() {

    vec4 color = texture2D(uTexture, vUV);

    // Discard the fragment if alpha is 0
    // if (color.a < 0.001) {
    //     discard;
    // }

    if (vInstanceHighlight > 5.0) {
        color *= vec4(0.65, 0.65, 0.65, 1.0); // 6 => shadow (strong)
    }
    if (vInstanceHighlight > 4.0) {
        color *= vec4(0.85, 0.85, 0.85, 1.0); // 5 => shadow (light)
    }
    else if (vInstanceHighlight > 3.0) {
        color *= vec4(0.9, 0.9, 0.9, 1.0); // 4 => shadow (mild)
    }
    else if (vInstanceHighlight > 2.0) {
        color *= vec4(0.7, 0.7, 0.7, 1.0); // 3 => shadow (neutral)
    }
    else if (vInstanceHighlight > 1.0) {
        color *= vec4(0.5, 1.0, 0.5, 1.0); // 2 => green
    }
    else if (vInstanceHighlight > 0.0) {
        color *= vec4(1.0, 0.5, 0.5, 1.0); // 1 => red
    }

    gl_FragColor = color;
}

