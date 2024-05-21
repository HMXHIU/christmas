float remap(float value, float srcMin, float srcMax, float dstMin, float dstMax) {
    return dstMin + (value - srcMin) * (dstMax - dstMin) / (srcMax - srcMin);
}

vec2 remap(vec2 value, vec2 srcMin, vec2 srcMax, vec2 dstMin, vec2 dstMax) {
    return dstMin + (value - srcMin) * (dstMax - dstMin) / (srcMax - srcMin);
}

vec3 remap(vec3 value, vec3 srcMin, vec3 srcMax, vec3 dstMin, vec3 dstMax) {
    return dstMin + (value - srcMin) * (dstMax - dstMin) / (srcMax - srcMin);
}

vec4 remap(vec4 value, vec4 srcMin, vec4 srcMax, vec4 dstMin, vec4 dstMax) {
    return dstMin + (value - srcMin) * (dstMax - dstMin) / (srcMax - srcMin);
}