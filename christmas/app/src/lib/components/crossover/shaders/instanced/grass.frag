precision highp float;

varying vec2 vUV;
varying vec2 vPosition;
varying vec2 vInstanceSize;

uniform sampler2D uTexture;

void main() {

    vec4 color = texture2D(uTexture, vUV);

    // Apply alpha mask (fade out from top to bottom)
    float alpha = mix(1.0, 0.0, vPosition.y / vInstanceSize.y);

    gl_FragColor = color * alpha;
}

