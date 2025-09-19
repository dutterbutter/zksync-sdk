// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  // Transpile every public .ts so dist mirrors src (needed for subpath exports)
  entry: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/e2e/**', // don't ship e2e helpers
    '!test/**',
  ],
  outDir: 'dist',

  // Emit both ESM and CJS to satisfy "module" and "main" fields
  format: ['esm', 'cjs'],
  target: 'es2022',

  // Keep files 1:1 (no bundling)
  bundle: false,
  splitting: false,
  skipNodeModulesBundle: true,

  // Declarations are handled by tsc in build:types
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

  // Respect your TS build config (paths, module settings, etc.)
  tsconfig: 'tsconfig.build.json',

  // Do NOT bundle these (they're peer deps for consumers)
  external: ['ethers', 'viem', '@typechain/ethers-v6'],

  // Allow importing JSON ABIs (with or without import assertions)
  loader: {
    '.json': 'json',
  },
});
