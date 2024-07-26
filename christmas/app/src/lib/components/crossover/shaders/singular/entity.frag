precision mediump float;

varying vec2 vUV;
varying vec2 vPosition;
varying float vInstanceHighlight;

uniform sampler2D uTexture;
uniform float uTextureHeight;
uniform float uTextureWidth;

uniform sampler2D uOverlayTexture;
uniform float uOverlayTextureEnabled;

void main() {

    vec4 color = texture2D(uTexture, vUV);

    // Overlay Texture
    if (uOverlayTextureEnabled > 0.0) {
        vec4 overlayColor = texture2D(uOverlayTexture, vUV);
        // Alpha compositing
        vec3 blendedColor = mix(color.rgb, overlayColor.rgb, overlayColor.a);
        float blendedAlpha = color.a + (1.0 - color.a) * overlayColor.a;
        color = vec4(blendedColor.rgb, blendedAlpha);
    }
    
    // Note: entities can't have alpha = 0, else it is hard to get the rendering order correct with grass
    if (color.a < 0.1) {
        discard;
    }

    // Highlighting
    if (vInstanceHighlight > 0.0) {

        // Outline color
        vec3 outlineColor = vec3(1.0, 0.0, 0.0); // red
        if (vInstanceHighlight > 2.0) {
            outlineColor = vec3(0.0, 0.0, 1.0); // blue
        }
        else if (vInstanceHighlight > 1.0) {
            outlineColor = vec3(0.0, 1.0, 0.0); // green
        }

        // Check neighboring pixels for outline
        float outlineStrength = 1.0; // Adjust this for thicker/thinner outline
        vec2 texelSize = vec2(1.0 / uTextureWidth, 1.0 / uTextureHeight);
    
        // Detect edge pixels
        float e = 0.0;
        for (float x = -1.0; x <= 1.0; x += 1.0) {
            for (float y = -1.0; y <= 1.0; y += 1.0) {
                if (x == 0.0 && y == 0.0) continue; // Skip center pixel
                vec2 samplePos = vUV + vec2(x, y) * texelSize * outlineStrength;
                vec4 sampleColor = texture2D(uTexture, samplePos);
                if (sampleColor.a < 0.1) {
                    e = 1.0;
                    break;
                }
            }
            if (e > 0.0) break;
        }
        
        // Check if the current pixel is at the edge of the texture
        if (e == 0.0) {
            if (vUV.x < texelSize.x * outlineStrength || vUV.x >= 1.0 - texelSize.x * outlineStrength ||
                vUV.y <= texelSize.y * outlineStrength || vUV.y > 1.0 - texelSize.y * outlineStrength) {
                e = 1.0;
            }
        }

        if (e > 0.0) {
            // This is an edge pixel, apply outline color
            color = vec4(outlineColor, 1.0);
        }
    }

    gl_FragColor = color;
}

