precision highp float;

varying vec2 vUV;
varying float vInstanceHighlight;

uniform sampler2D uTexture;

void main() {

    vec4 color = texture2D(uTexture, vUV);
    
    // Apply highlights
    color = highlightColor(color, vInstanceHighlight);

    gl_FragColor = color;
}

