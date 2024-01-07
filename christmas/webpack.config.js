const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

// Load variables from .env
require("dotenv").config();

module.exports = {
    entry: "./app/src/index.ts",
    module: {
        rules: [
            // Compile ts to js
            {
                test: /\.ts?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
            // Bundle & minify css
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, "css-loader"],
            },
        ],
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ["buffer", "Buffer"],
        }),
        new webpack.ProvidePlugin({
            process: "process/browser.js",
        }),
        new webpack.EnvironmentPlugin([
            "GOOGLE_MAPS_API_KEY",
            "NFT_STORAGE_TOKEN",
            "ANCHOR_BROWSER",
            "MINIO_ENDPOINT",
            "MINIO_PORT",
            "MINIO_BUCKET",
            "MINIO_ACCESS_KEY",
            "MINIO_SECRET_KEY",
            "MINIO_USE_SSL",
        ]),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "./app/src/index.html"),
            scriptLoading: "blocking",
            templateParameters: {
                GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
            },
        }),
        new MiniCssExtractPlugin(),
        new CopyPlugin({
            patterns: [
                // Copy shoelace assets
                {
                    from: path.resolve(
                        __dirname,
                        "node_modules/@shoelace-style/shoelace/dist/assets"
                    ),
                    to: path.resolve(__dirname, "./app/dist/shoelace/assets"),
                },
            ],
        }),
    ],
    resolve: {
        extensions: [".tsx", ".ts", ".js", ".json"],
        fallback: {
            zlib: require.resolve("browserify-zlib"),
            https: require.resolve("https-browserify"),
            http: require.resolve("stream-http"),
            stream: require.resolve("stream-browserify"),
            crypto: require.resolve("crypto-browserify"),
            url: require.resolve("url"),
            path: require.resolve("path-browserify"),
            timers: require.resolve("timers-browserify"),
            fs: require.resolve("browserify-fs"),
        },
    },
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "./app/dist"),
        clean: true,
    },
    devtool: "source-map",
    devServer: {
        static: path.join(__dirname, "./app/dist"),
        compress: true,
        port: 4000,
        devMiddleware: {
            writeToDisk: true, // write to "./app/dist"
        },
        historyApiFallback: {
            // Redirect all 404 errors to index.html
            rewrites: [{ from: /^\/(.*)$/, to: "/index.html" }],
        },
    },
};
