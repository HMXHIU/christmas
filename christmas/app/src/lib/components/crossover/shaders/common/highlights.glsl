vec4 highlightColor(vec4 color, float highlight) {
    // 6 => shadow (strong)
    if (highlight > 5.0) {
        color *= vec4(0.65, 0.65, 0.65, 1.0); 
    }
    // 5 => shadow (light)
    else if (highlight > 4.0) {
        color *= vec4(0.85, 0.85, 0.85, 1.0); 
    }
    // 4 => shadow (mild)
    else if (highlight > 3.0) {
        color *= vec4(0.9, 0.9, 0.9, 1.0); 
    }
    // 3 => shadow (neutral)
    else if (highlight > 2.0) {
        color *= vec4(0.7, 0.7, 0.7, 1.0); 
    }
    // 2 => green
    else if (highlight > 1.0) {
        color *= vec4(0.5, 1.0, 0.5, 1.0); 
    }
    // 1 => red
    else if (highlight > 0.0) {
        color *= vec4(1.0, 0.5, 0.5, 1.0); 
    }
    return color;
}
