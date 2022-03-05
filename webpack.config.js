import path from 'path'
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import nodeExternals from 'webpack-node-externals'

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
        test: /\.csv$/,
        loader: 'csv-loader',
        options: {
          dynamicTyping: true,
          header: true,
          skipEmptyLines: true,
        },
      },
      {
        test: /\.(js|ts)$/,
        exclude: /node_modules/,
        use: [{ loader: 'babel-loader' }],
      },
    ],
  },
  resolve: { extensions: ['.ts', '.js'] },
  experiments: { outputModule: true, topLevelAwait: true },
  externalsPresets: { node: true },
  externalsType: 'node-commonjs',  
  externals: [
    nodeExternals({
      importType: 'node-commonjs'
    }),
  ],
}
