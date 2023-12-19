const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require("webpack");

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
        new webpack.DefinePlugin({
            "process.env.ANCHOR_BROWSER": JSON.stringify(true),
            process: {
                env: {
                    ANCHOR_BROWSER: JSON.stringify(true),
                },
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
                // Copy index.html
                {
                    from: path.resolve(__dirname, "./app/src/index.html"),
                    to: path.resolve(__dirname, "./app/dist/index.html"),
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
        historyApiFallback: {
            // Redirect all 404 errors to index.html
            rewrites: [{ from: /^\/(.*)$/, to: "/index.html" }],
        },
    },
};
