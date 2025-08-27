import { defineConfig } from 'tsup';

export default defineConfig({
  // Compile every .ts file so dist mirrors src for subpath imports
  entry: ['src/**/*.ts', '!src/**/__tests__/**', '!src/**/__mocks__/**'],
  outDir: 'dist',

  format: ['esm', 'cjs'],
  target: 'es2022',

  // Keep module boundaries so each file maps 1:1 (no bundling)
  bundle: false,
  splitting: false,
  skipNodeModulesBundle: true,

  dts: false,
  sourcemap: true,
  clean: true,
  minify: false,
  shims: false,
  treeshake: true,

  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },

  tsconfig: 'tsconfig.build.json',
});
