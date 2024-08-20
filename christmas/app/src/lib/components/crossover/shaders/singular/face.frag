precision highp float;

varying vec2 vUV;
varying vec2 vPosition;
varying float vInstanceHighlight;

uniform sampler2D uFaceTexture;
uniform sampler2D uBackHairTexture;
uniform sampler2D uEyesTexture;
uniform sampler2D uFrontHairTexture;

uniform sampler2D uFaceNormalTexture;
uniform sampler2D uBackHairNormalTexture;
uniform sampler2D uFrontHairNormalTexture;

uniform float uFaceTextureEnabled;
uniform float uBackHairTextureEnabled;
uniform float uEyesTextureEnabled;
uniform float uFrontHairTextureEnabled;

uniform float uFaceNormalTextureEnabled;
uniform float uBackHairNormalTextureEnabled;
uniform float uFrontHairNormalTextureEnabled;

uniform float uTextureHeight;
uniform float uTextureWidth;

vec4 applyNormalMap(vec4 color, sampler2D normalTexture, float enabled) {
    if (enabled > 0.0) {
        vec3 normal = texture2D(normalTexture, vUV).rgb * 2.0 - 1.0;
        float lighting = dot(normal, normalize(vec3(1.0, 1.0, 0.5)));
        return vec4(color.rgb * (0.5 + 0.5 * lighting), color.a);
    }
    return color;
}

void main() {
    vec4 finalColor = vec4(0.0);

    // Apply textures in the correct order
    if (uBackHairTextureEnabled > 0.0) {
        vec4 backHairColor = texture2D(uBackHairTexture, vUV);
        backHairColor = applyNormalMap(backHairColor, uBackHairNormalTexture, uBackHairNormalTextureEnabled);
        finalColor = mix(finalColor, backHairColor, backHairColor.a);
    }

    if (uFaceTextureEnabled > 0.0) {
        vec4 faceColor = texture2D(uFaceTexture, vUV);
        faceColor = applyNormalMap(faceColor, uFaceNormalTexture, uFaceNormalTextureEnabled);
        finalColor = mix(finalColor, faceColor, faceColor.a);
    }

    if (uEyesTextureEnabled > 0.0) {
        vec4 eyesColor = texture2D(uEyesTexture, vUV);
        finalColor = mix(finalColor, eyesColor, eyesColor.a);
    }

    if (uFrontHairTextureEnabled > 0.0) {
        vec4 frontHairColor = texture2D(uFrontHairTexture, vUV);
        frontHairColor = applyNormalMap(frontHairColor, uFrontHairNormalTexture, uFrontHairNormalTextureEnabled);
        finalColor = mix(finalColor, frontHairColor, frontHairColor.a);
    }

    // Discard fully transparent pixels
    if (finalColor.a < 0.1) {
        discard;
    }

    gl_FragColor = finalColor;
}