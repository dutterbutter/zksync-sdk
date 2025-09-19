// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  // Transpile every public .ts so dist mirrors src (needed for subpath exports)
  entry: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/e2e/**',
    '!test/**',
  ],
  outDir: 'dist',

  // Emits both ESM and CJS to satisfy "module" and "main" fields
  format: ['esm', 'cjs'],
  target: 'es2022',

  bundle: false,
  splitting: false,
  skipNodeModulesBundle: true,

  dts: false,
  sourcemap: true,
  clean: true,
  minify: false,
  shims: false,
  treeshake: true,

  // Ensure .cjs for CJS, .js for ESM
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },

  tsconfig: 'tsconfig.build.json',
  external: ['ethers', 'viem', '@typechain/ethers-v6'],
  loader: {
    '.json': 'json',
  },
});
