import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/state-manager.ts',
  plugins: [typescript(), resolve(), commonjs()],
  onwarn: (e) => {
    throw new Error(e);
  },
  output: [
    {
      name: 'StateManager',
      file: 'dist/state-manager.js',
      format: 'umd',
    },
    {
      file: 'dist/state-manager.es.js',
      format: 'es',
    },
  ],
};
