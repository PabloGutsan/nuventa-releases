const webpack = require('webpack');

module.exports = function override(config) {
    const fallback = config.resolve.fallback || {};
    
    Object.assign(fallback, {
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "path": require.resolve("path-browserify"),
        "buffer": require.resolve("buffer"),
        "fs": false,
        "vm": false,  // ✅ Agregar
        "process": false,  // ✅ Agregar
        "http": false,
        "https": false,
        "os": false,
        "url": false,
        "zlib": false,
        "assert": false
    });
    
    config.resolve.fallback = fallback;
    
    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        })
    ]);
    
    config.ignoreWarnings = [/Failed to parse source map/];
    
    // ✅ Agregar esta regla para resolver módulos .mjs
    config.module.rules.push({
        test: /\.m?js/,
        resolve: {
            fullySpecified: false
        }
    });
    
    return config;
};