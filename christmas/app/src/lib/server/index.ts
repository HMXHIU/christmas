import jwt, { type JwtPayload } from "jsonwebtoken";
import { JWT_SECRET_KEY, JWT_EXPIRES_IN } from "$env/static/private";

export async function signJWT(payload: object): Promise<string> {
    return new Promise((resolve, reject) => {
        jwt.sign(
            payload,
            JWT_SECRET_KEY,
            {
                expiresIn: JWT_EXPIRES_IN,
            },
            (err, token) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(token!);
                }
            },
        );
    });
}

export function verifyJWT(token: string): Promise<string | JwtPayload> {
    return new Promise((resolve, reject) => {
        jwt.verify(token, JWT_SECRET_KEY, (err, decoded) => {
            if (err) {
                reject(err);
            } else {
                resolve(decoded!);
            }
        });
    });
}
