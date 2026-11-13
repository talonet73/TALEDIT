import { build } from 'esbuild';
await build({
  entryPoints: ['server.ts'], outfile: 'desktop/server.mjs',
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
});
