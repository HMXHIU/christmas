precision mediump float;

in vec2 vUV;
uniform sampler2D uTexture;
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

vec3 calculateNormal(vec2 uv) {
    vec2 uTextureSize = vec2(uTextureWidth, uTextureHeight);
    vec2 texelSize = 1.0 / uTextureSize;
    
    float left = sampleTextureBilinear(uTexture, uv - vec2(texelSize.x, 0.0)).r;
    float right = sampleTextureBilinear(uTexture, uv + vec2(texelSize.x, 0.0)).r;
    float top = sampleTextureBilinear(uTexture, uv - vec2(0.0, texelSize.y)).r;
    float bottom = sampleTextureBilinear(uTexture, uv + vec2(0.0, texelSize.y)).r;
    
    float heightScale = 70.0; // Increase this value to exaggerate height differences
    vec3 normal = normalize(vec3((left - right) * heightScale, 2.0, (bottom - top) * heightScale));
    return normal;
}

vec3 getTerrainColor(float height) {
    // Define color stops for different terrain types
    vec3 deepWater = vec3(0.4392, 0.5765, 0.5529);
    vec3 shallowWater = vec3(0.5098, 0.6471, 0.6235);
    vec3 lowLand = vec3(0.7059, 0.7529, 0.7059);  // New category for very low-lying land
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

void main() {

    // vec4 color = texture2D(uTexture, vUV);
    vec4 color = sampleTextureBilinear(uTexture, vUV);

    // Get the height & color value from the texture
    float height = color.r;
    vec3 terrainColor = getTerrainColor(height);

    // Calculate diffuse lighting
    vec3 uLightDir = vec3(1.0, 1.0, -1.0);
    vec3 normal = calculateNormal(vUV);
    vec3 lightDir = normalize(uLightDir);
    float diffuse = max(dot(normal, lightDir), 0.0);
    
    // Add ambient light to avoid completely dark areas
    float ambient = 0.1;
    float lightIntensity = ambient + diffuse * 0.9;
    // float lightIntensity = 0.7 + 0.3 * height;

    gl_FragColor = vec4(terrainColor * lightIntensity, 1.0);
}