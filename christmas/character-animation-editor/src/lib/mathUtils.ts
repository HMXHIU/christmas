// src/lib/mathUtils.ts

interface Vector2D {
    x: number;
    y: number;
}

export function normalize(vector: Vector2D): Vector2D {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    return {
        x: vector.x / length,
        y: vector.y / length,
    };
}

export function dot(v1: Vector2D, v2: Vector2D): number {
    return v1.x * v2.x + v1.y * v2.y;
}

export function rotatePoint(point: Vector2D, angle: number): Vector2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos,
    };
}
