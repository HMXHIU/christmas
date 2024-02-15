var mock = require("mock-require");
require("dotenv").config();

console.log("Setting up mock $env/static/public");
mock("$env/static/public", {
    PUBLIC_HOST: process.env.PUBLIC_HOST,
    PUBLIC_NFT_STORAGE_TOKEN: process.env.PUBLIC_NFT_STORAGE_TOKEN,
    PUBLIC_GOOGLE_MAPS_API_KEY: process.env.PUBLIC_GOOGLE_MAPS_API_KEY,
    PUBLIC_FEE_PAYER_PUBKEY: process.env.PUBLIC_FEE_PAYER_PUBKEY,
    PUBLIC_RPC_ENDPOINT: process.env.PUBLIC_RPC_ENDPOINT,
    PUBLIC_JWT_EXPIRES_IN: process.env.PUBLIC_JWT_EXPIRES_IN,
    PUBLIC_REFRESH_JWT_EXPIRES_IN: process.env.PUBLIC_REFRESH_JWT_EXPIRES_IN,
});

console.log("Setting up mock $env/static/private");
mock("$env/static/private", {
    ENVIRONMENT: process.env.ENVIRONMENT,
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
    MINIO_PORT: process.env.MINIO_PORT,
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
    MINIO_USE_SSL: process.env.MINIO_USE_SSL,
    ANCHOR_BROWSER: process.env.ANCHOR_BROWSER,
    FEE_PAYER_PRIVATE_KEY: process.env.FEE_PAYER_PRIVATE_KEY,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_USERNAME: process.env.REDIS_USERNAME,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
    REFRESH_JWT_SECRET_KEY: process.env.REFRESH_JWT_SECRET_KEY,
});
