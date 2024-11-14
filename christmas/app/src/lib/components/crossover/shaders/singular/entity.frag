precision highp float;

varying vec2 vUV;
varying vec2 vPosition;
varying float vInstanceHighlight;

uniform sampler2D uTexture;
uniform float uTextureHeight;
uniform float uTextureWidth;

uniform sampler2D uOverlayTexture;
uniform float uOverlayTextureEnabled;

uniform sampler2D uNormalTexture;
uniform float uNormalTextureEnabled;

uniform sampler2D uOverlayNormalTexture;
uniform float uOverlayNormalTextureEnabled;

uniform vec4 uTint;
uniform float uMask;
uniform float uAlpha;
uniform vec3 uLight; // x, y, intensity

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

    // Apply normal map lightning
    if(uLight[2] > 0.0 && uNormalTextureEnabled > 0.0) {
        // Sample the normal map
        vec4 normalColor = texture2D(uNormalTexture, vUV);
        
        // Convert normal map color from [0,1] to [-1,1] range
        vec3 normal = normalize(normalColor.rgb * 2.0 - 1.0);
        
        // Create light direction vector (normalize to ensure it's a unit vector)
        vec3 lightDir = normalize(vec3(uLight.xy, 1.0));
        
        // Calculate dot product between normal and light direction
        float lightIntensity = max(dot(normal, lightDir), 0.0);
        
        // Apply light intensity and user-defined light strength (TODO: pass in ambient instead of 0.5 hardcode)
        float finalLightIntensity = mix(0.5, 1.0, lightIntensity * uLight[2]);
        
        // Apply lighting to color
        color.rgb *= finalLightIntensity;
        
        // If overlay normal map is enabled, blend it
        if(uOverlayNormalTextureEnabled > 0.0) {
            vec4 overlayNormal = texture2D(uOverlayNormalTexture, vUV);
            vec3 blendedNormal = normalize(mix(normal, normalize(overlayNormal.rgb * 2.0 - 1.0), overlayNormal.a));
            lightIntensity = max(dot(blendedNormal, lightDir), 0.0);
            finalLightIntensity = mix(0.5, 1.0, lightIntensity * uLight[2]);
            color.rgb *= finalLightIntensity;
        }
    }

    // Apply highlights
    color = highlightColor(color, vInstanceHighlight);

    // Apply alpha (multiplicative)
    color.a = color.a * uAlpha;

    gl_FragColor = color;
}

