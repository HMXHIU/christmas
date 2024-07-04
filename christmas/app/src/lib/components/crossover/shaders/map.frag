precision mediump float;

in vec2 vUV;
uniform sampler2D uTexture;

void main() {

    vec4 color = texture2D(uTexture, vUV);

    if (color.r < 0.001) {
        color = vec4(0.0, 0.0, 1.0, 1.0);
    } else {
        color = vec4(1.0, 0.0, 0.0, 1.0);
    }

    gl_FragColor = color;
}