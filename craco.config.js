const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.alias = webpackConfig.resolve.alias || {};

      // ── Excalidraw ESM imports ──────────────────────────────
      webpackConfig.resolve.alias['roughjs/bin/generator'] = 'roughjs/bin/generator.js';
      webpackConfig.resolve.alias['roughjs/bin/rough']     = 'roughjs/bin/rough.js';
      webpackConfig.resolve.alias['roughjs/bin/math']      = 'roughjs/bin/math.js';

      // ── Node polyfills for BlockNote (Webpack 5 removed them) ─
      webpackConfig.resolve.alias['process/browser'] = require.resolve('process/browser.js');
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        vm:   false,
        path: false,
        fs:   false,
      };

      // Provide global `process` and `Buffer` that some deps expect
      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer:  ['buffer', 'Buffer'],
        }),
      ];

      // Suppress "Critical dependency: the request of a dependency is an
      // expression" warnings from deep BlockNote / ProseMirror imports
      webpackConfig.module = webpackConfig.module || {};
      webpackConfig.module.exprContextCritical = false;

      return webpackConfig;
    },
  },
};
