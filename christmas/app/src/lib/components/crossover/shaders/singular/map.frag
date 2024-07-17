precision mediump float;

in vec2 vUV;
uniform sampler2D uTexture;
uniform sampler2D uParchmentTexture;
uniform float uTextureHeight;
uniform float uTextureWidth;

vec4 sampleTextureBilinear(sampler2D tex, vec2 uv) {
    vec2 uTextureSize = vec2(uTextureWidth, uTextureHeight);
    vec2 texelSize = 1.0 / uTextureSize;
    vec2 f = fract(uv * uTextureSize);
    vec2 centeredUV = uv - f * texelSize;

    vec4 tl = texture2D(tex, centeredUV);
    vec4 tr = texture2D(tex, centeredUV + vec2(texelSize.x, 0.0));
    vec4 bl = texture2D(tex, centeredUV + vec2(0.0, texelSize.y));
    vec4 br = texture2D(tex, centeredUV + vec2(texelSize.x, texelSize.y));

    vec4 tMix = mix(tl, tr, f.x);
    vec4 bMix = mix(bl, br, f.x);
    return mix(tMix, bMix, f.y);
}

vec3 getTerrainColor(float height) {
    // Define color stops for different terrain types
    vec3 deepWater = vec3(0.4392, 0.5765, 0.5529);
    vec3 shallowWater = vec3(0.5098, 0.6471, 0.6235);
    vec3 lowLand = vec3(0.7059, 0.7529, 0.7059);
    vec3 sand = vec3(0.8314, 0.7882, 0.7059);
    vec3 grass = vec3(0.8314, 0.7216, 0.6392);
    vec3 forest = vec3(0.8314, 0.8118, 0.8000);
    vec3 rock = vec3(0.9216, 0.9216, 0.9294);
    vec3 snow = vec3(0.9608, 0.9608, 0.9608);

    // Adjust these thresholds to match your data
    if (height < 0.001) return deepWater;  // Truly underwater (value 0 in PNG)
    if (height < 0.01) return mix(shallowWater, lowLand, (height - 0.001) / 0.009);  // Very low-lying land (values 1-2 in PNG)
    if (height < 0.05) return mix(lowLand, sand, (height - 0.01) / 0.04);
    if (height < 0.2) return mix(sand, grass, (height - 0.05) / 0.15);
    if (height < 0.4) return mix(grass, forest, (height - 0.2) / 0.2);
    if (height < 0.6) return mix(forest, rock, (height - 0.4) / 0.2);
    return mix(rock, snow, (height - 0.6) / 0.4);
}

float getHeight(vec2 uv) {
    return sampleTextureBilinear(uTexture, uv).r;
}

float detectLandBoundaries(vec2 uv) {
   
    // Check neighboring pixels for outline
    float outlineStrength = 1.0; // Adjust this for thicker/thinner outline
    vec2 texelSize = vec2(1.0 / uTextureWidth, 1.0 / uTextureHeight);

    if (getHeight(uv) < 0.001) {
        return 0.0;
    }

    // Detect edge pixels
    float e = 0.0;
    for (float x = -1.0; x <= 1.0; x += 1.0) {
        for (float y = -1.0; y <= 1.0; y += 1.0) {
            if (x == 0.0 && y == 0.0) continue; // Skip center pixel
            vec2 suv = uv + vec2(x, y) * texelSize * outlineStrength;
            if (getHeight(suv) < 0.001) {
                e = 1.0;
                break;
            }
        }
        if (e > 0.0) break;
    }
    
    return e;
}

void main() {

    float height = getHeight(vUV);
    float boundary = detectLandBoundaries(vUV);

    // Get base terrain color
    vec3 terrainColor = getTerrainColor(height);

    // Get parchment color (Adjust the UV scale to match your parchment texture)
    vec3 parchmentColor = texture2D(uParchmentTexture, vUV * 1.0).rgb;
    
    // Combine everything
    vec3 combined = mix(
        mix(terrainColor, parchmentColor, 0.6),
        vec3(0.4, 0.4, 0.4),
        boundary * 0.5
    );

    // Simple shading
    float shading = 0.8 + 0.2 * height;

    gl_FragColor = vec4(combined * shading,  1.0);
}