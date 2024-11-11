precision highp float;

varying vec2 vUV;
varying vec2 vPosition;
varying float vInstanceHighlight;

uniform sampler2D uTexture;
uniform float uTextureHeight;
uniform float uTextureWidth;

uniform sampler2D uOverlayTexture;
uniform float uOverlayTextureEnabled;
uniform vec4 uTint;
uniform float uMask;
uniform float uAlpha;

void main() {

    vec4 color = texture2D(uTexture, vUV);

    // Apply tint as mask (replace)
    if(uMask > 0.0 && color.a > 0.0) {
        color = uTint;
    }
    // Apply tint (amount depends on uTint.a) 
    else if(uTint.a > 0.0) {
        color.rgb = mix(color.rgb, uTint.rgb, uTint.a);
    }

    // Overlay Texture
    if (uOverlayTextureEnabled > 0.0) {
        vec4 overlayColor = texture2D(uOverlayTexture, vUV);
        // Alpha compositing
        vec3 blendedColor = mix(color.rgb, overlayColor.rgb, overlayColor.a);
        float blendedAlpha = color.a + (1.0 - color.a) * overlayColor.a;
        color = vec4(blendedColor.rgb, blendedAlpha);
    }
    
    /* 
    Don't color the fragment if alpha is 0
    - Can't easily control the render order of individual instances if instanced shaders (biome decorations)
    - Either discard the alpha of entities or instanced shaders (choose to discard alpha of entities)
    */
    if (color.a < 0.01) {
        discard;
    }

    // Apply highlights
    color = highlightColor(color, vInstanceHighlight);

    // Apply alpha (multiplicative)
    color.a = color.a * uAlpha;

    gl_FragColor = color;
}

