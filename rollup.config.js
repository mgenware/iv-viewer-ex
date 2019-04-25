import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';

const isProd = process.env.NODE_ENV == 'production';

const plugins = [
  resolve(),
  commonjs(),
  typescript({ cacheRoot: require('unique-temp-dir')() }),
];

if (isProd) {
  tsPlugins.push(terser());
}

const tasks = [
  {
    input: 'src/main.ts',
    output: {
      name: 'ivViewerEx',
      file: 'dist/main.js',
      format: 'umd',
      exports: 'named',
    },
    plugins,
  },
  {
    input: 'src/ImageViewer.scss',
    output: {
      file: 'dist/iv-viewer.css',
      format: 'esm',
    },
    plugins: [
      postcss({
        plugins: [autoprefixer],
        extract: './dist/iv-viewer.css',
        extensions: ['.css', '.sss', '.scss']
      }),
    ],
  },
];

export default tasks;
