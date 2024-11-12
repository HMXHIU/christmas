precision highp float;

varying vec2 vUV;
varying vec2 vPosition;

uniform sampler2D uTexture;

uniform vec4 uLight0;  // x, y, intensity, highlight (<0 indicates off)
uniform vec4 uLight1;
uniform vec4 uLight3;
uniform vec4 uLight4;
uniform vec4 uLight5;
uniform vec4 uLight6;
uniform vec4 uLight7;
uniform vec4 uLight8;
uniform vec4 uLight9;

uniform float uAmbientLight; // 0.0 to 1.0

float calculateLight(vec2 position, vec2 lightPos, float intensity) {
    // The units of position and light are in isometric world coordinates (64 pixels = 1m)
    float dist = length(position - lightPos) / 64.0;
    float lightRadius = 2.0; // 2 m
    float distNorm = dist / lightRadius;

    // Inverse square falloff, clamped to avoid division by zero
    return intensity / (1.0 + distNorm * distNorm);
}

void main() {

    // Start with ambient light
    float lightLevel = uAmbientLight;
   
    // Add contribution from each light source
    if(uLight0.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight0.xy, uLight0.z);
    }
    
    // Clamp the final light level
    lightLevel = clamp(lightLevel, 0.0, 1.0);

    // The darker it is, the more of the darkness overlay we see
    vec4 darkness = vec4(0.0, 0.0, 0.0, 0.7);
    gl_FragColor = darkness * (1.0 - lightLevel);
}

