precision highp float;

varying vec2 vUV;
varying vec2 vPosition;

uniform sampler2D uTexture;

uniform vec4 uLight0;  // x, y, intensity, highlight (<0 indicates off)
uniform vec4 uLight1;
uniform vec4 uLight2;
uniform vec4 uLight3;
uniform vec4 uLight4;
uniform vec4 uLight5;
uniform vec4 uLight6;
uniform vec4 uLight7;
uniform vec4 uLight8;
uniform vec4 uLight9;

uniform vec3 uDarkness; // color of darkness
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

    // Add contribution from each light source
    float lightLevel = 0.0;
    if(uLight0.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight0.xy, uLight0.z);
    }
    if(uLight1.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight1.xy, uLight1.z);
    }
    if(uLight2.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight2.xy, uLight2.z);
    }
    if(uLight3.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight3.xy, uLight3.z);
    }
    if(uLight4.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight4.xy, uLight4.z);
    }
    if(uLight5.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight5.xy, uLight5.z);
    }
    if(uLight6.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight6.xy, uLight6.z);
    }
    if(uLight7.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight7.xy, uLight7.z);
    }
    if(uLight8.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight8.xy, uLight8.z);
    }
    if(uLight9.a > 0.0) {
        lightLevel += calculateLight(vPosition, uLight9.xy, uLight9.z);
    }
    
    // Clamp the final light level
    lightLevel = clamp(lightLevel, 0.0, 1.0);

    // The darker it is, the more of the darkness overlay we see
    gl_FragColor = vec4(uDarkness.rgb, (1.0 - uAmbientLight) * (1.0 - lightLevel));
}

