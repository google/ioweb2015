var webpack = require('webpack');
var CompressionPlugin = require('compression-webpack-plugin');


module.exports = {
  entry: {
    experiment: './app/index.js',
    loader: "./loader/index.js"
  },

  resolve: {
    root: __dirname
  },

  output: {
    path: __dirname + '/public',
    filename: 'js/[name].js'
  },

  module: {
    preLoaders: [
      {
        test: /\.js$/,
        exclude: /node_modules|vendor|public|app\/debug\.js/,
        loader: 'jshint-loader'
      }
    ],

    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules|vendor|public/,
        loader: '6to5-loader?runtime=true'
      },
      {
        test: /\.json$/,
        loader: 'json-loader'
      },
      {
        test: /\.css$/,
        loader: 'style-loader/useable!css-loader!autoprefixer-loader?browsers=last 2 version'
      }
    ]
  },

  plugins: [
    new webpack.DefinePlugin({
      __STATIC_BASE_EXPERIMENT__: '"' + (process.env.STATIC_BASE || '/') + '"',
    }),
    new webpack.ProvidePlugin({
      to5Runtime: 'imports?global=>{}!exports-loader?global.to5Runtime!6to5/runtime'
    }),
    new CompressionPlugin({
      asset: '{file}.gz',
      algorithm: "gzip",
      regExp: /\.js$/,
      threshold: 10240,
      minRatio: 0.8
    })
  ],

  jshint: {}
};
