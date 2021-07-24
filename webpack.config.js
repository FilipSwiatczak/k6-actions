const path = require('path');

module.exports = {
    mode: "production",
    context: path.join(__dirname, 'src'),
    entry: {
        main: './main.ts'
    },
    output: {
        path: path.join(__dirname, 'web'),
        libraryTarget: "commonjs",
        filename: "[name].js"
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {loader: "babel-loader", options: {presets: [
                    ["@babel/preset-typescript", {targets: "defaults"}],
                    ["@babel/preset-env", {targets: "defaults"}],
                  ]}}
            }
        ]
    },
    target: "web",
    externals: /k6(\/.*)?/,
    stats: {colors: true}
};