attribute vec2 aPosition;
attribute vec2 aInstancePosition;
attribute vec2 aUV;

varying vec2 vPosition;
varying vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

// uniform mat3 uWorldStageTransform;
uniform float uTx;
uniform float uTy;
uniform float uCx;
uniform float uCy;

// uniform float uSkewX
// uniform float uSkewY

// uniform skews {
//     float uSkewX;
//     float uSkewY;
// };


void main() {

    // // Isometric projection matrix
    // mat3 isometricProjection = mat3(
    //     0.7071, 0.0, 0.7071,
    // 0.0, 0.5, 0.0,
    // -0.7071, 0.0, 0.7071
    // );

    // mat2 rotate = mat2(
    //     cos(uTransformMatrix[2][2]), -sin(uTransformMatrix[2][2]),
    //     sin(uTransformMatrix[2][2]), cos(uTransformMatrix[2][2])
    // );

    // // create a rotation matrix of 45 degrees
    // mat2 rotate = mat2(
    //     cos(0.785398), -sin(0.785398),
    //     sin(0.785398), cos(0.785398)
    // );

    // // create a 3d rotation matrix to rotate the object in 3d space by 30 degrees
    // mat3 rotate = mat3(
    //     cos(0.523599), -sin(0.523599), 0.0,
    //     sin(0.523599), cos(0.523599), 0.0,
    //     0.0, 0.0, 1.0
    // );

    // // rotate in the x axis
    // mat3 rotateInXAxis = mat3(
    //     1.0, 0.0, 0.0,
    //     0.0, cos(0.523599), -sin(0.523599),
    //     0.0, sin(0.523599), cos(0.523599)
    // );

    // //rotate in y axis
    // mat3 rotateInYAxis = mat3(
    //     cos(0.523599), 0.0, sin(0.523599),
    //     0.0, 1.0, 0.0,
    //     -sin(0.523599), 0.0, cos(0.523599)
    // );
    

    // Create a skew transformation matrix
    mat3 skewMatrix = mat3(
        1.0, 0.3, 0.0,
        0.7, 1.0, 0.0,
        0.0, 0.0, 1.0
    );

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix; 
    gl_Position = vec4((mvp * vec3(aPosition + aInstancePosition + vec2(uTx, uTy) - vec2(uCx, uCy), 1.0)).xy, 0.0, 1.0) ;
    vUV = aUV;
    vPosition = aPosition;
}
