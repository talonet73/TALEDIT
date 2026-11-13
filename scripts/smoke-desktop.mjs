import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';

const dataDir = await mkdtemp(path.join(os.tmpdir(), 'taledit-smoke-'));
Object.assign(process.env, {
  NODE_ENV: 'production', TALEDIT_DESKTOP: '1', TALEDIT_HOST: '127.0.0.1', PORT: '0',
  TALEDIT_STATIC_DIR: path.resolve('dist'), TALEDIT_DATA_DIR: dataDir, TALEDIT_FFMPEG: ffmpeg,
});
const { startServer } = await import('../desktop/server.mjs');
const server = await startServer();
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  assert.equal(server.address().address, '127.0.0.1');
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /TALedit/);
  for (const asset of ['taledit-logo.png', 'taledit.ico']) {
    const response = await fetch(`${origin}/${asset}`);
    assert.equal(response.status, 200);
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  }
  const status = await (await fetch(`${origin}/api/mcp/status`)).json();
  assert.equal(status.status, 'active');
  const exported = await (await fetch(`${origin}/api/export`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'wav', durationSec: 1, clips: [] }),
  })).json();
  assert.equal(exported.success, true, exported.error);
  const wav = Buffer.from(await (await fetch(`${origin}${exported.downloadUrl}`)).arrayBuffer());
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
  console.log('Desktop smoke passed: loopback server, UI, logo, ICO, MCP, bundled FFmpeg export.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
}
