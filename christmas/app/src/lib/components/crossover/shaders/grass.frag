precision mediump float;

varying vec2 vUV;
varying vec2 vPosition;

uniform sampler2D uTexture;
uniform float uTextureHeight;
uniform float uTextureWidth;


void main() {
    vec4 textureColor = texture2D(uTexture, vUV);

    // Apply alpha mask (fade out from top to bottom)
    float alpha = mix(1.0, 0.0, vPosition.y/uTextureHeight);
    textureColor *= alpha;

    gl_FragColor = textureColor;
}

