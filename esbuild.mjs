import { build, context } from 'esbuild';
const production = process.argv.includes('--production');

const hostOptions = {
  entryPoints: {
    extension: 'src/extension.ts',
    'tests/integration/index': 'tests/integration/index.ts',
    'tests/preview/astro-preview': 'tests/preview/astro-preview.ts',
    'tests/integration/restricted': 'tests/integration/restricted.ts',
  },
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

const browserOptions = {
  entryPoints: ['webview/main.tsx'],
  outdir: 'dist/webview',
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  sourcemap: !production,
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const contexts = await Promise.all([context(hostOptions), context(browserOptions)]);
  await Promise.all(contexts.map(buildContext => buildContext.watch()));
} else {
  await Promise.all([build(hostOptions), build(browserOptions)]);
}
