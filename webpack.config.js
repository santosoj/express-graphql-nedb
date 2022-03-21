import path from 'path'
import { fileURLToPath } from 'url'
import nodeExternals from 'webpack-node-externals'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  mode: 'development',
  target: 'node',
  // devtool: false,
  entry: './src/index.ts',
  output: {
    path: __dirname + '/dist',
    filename: 'index.js',
    chunkFormat: 'module',
  },
  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        exclude: /node_modules/,
        use: [{ loader: 'babel-loader' }],
      },
      {
        test: /\.csv$/,
        loader: 'csv-loader',
        options: {
          dynamicTyping: true,
          header: true,
          skipEmptyLines: true,
        },
      },
      {
        test: /\.graphql$/,
        type: 'asset/source',
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.graphql'],
  },
  experiments: { outputModule: true, topLevelAwait: true },
  externalsPresets: { node: true },
  externalsType: 'node-commonjs',
  externals: [
    nodeExternals({
      importType: 'node-commonjs',
    }),
  ],
}
