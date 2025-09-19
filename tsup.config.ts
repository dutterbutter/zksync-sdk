// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  // Mirror src so subpath exports like "./core/*" resolve to real files.
  // We exclude tests, mocks, e2e, etc.
  entry: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/e2e/**',
    '!test/**',
  ],
  outDir: 'dist',

  // Emit both ESM and CJS to satisfy "module" and "main"
  format: ['esm', 'cjs'],
  target: 'es2022',

  // Key: inline internal imports so no ".ts" specifiers remain in dist
  bundle: true,
  splitting: false, // simpler dual-outputs without chunks
  skipNodeModulesBundle: true, // keep peers external
  external: ['ethers', 'viem', '@typechain/ethers-v6'],

  dts: false, // you generate .d.ts via `tsc`
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  shims: false,

  // Make CJS end in .cjs and ESM in .js
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },

  tsconfig: 'tsconfig.build.json',

  // Inline JSON (ABIs, etc.) into the bundles – no copy step needed
  loader: { '.json': 'json' },
});
