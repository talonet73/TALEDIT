// The complete offline app is served by launcher.cjs; Electron only hosts its UI.
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
const { runtime, control } = require('./launcher.cjs');
const config = runtime(__dirname);
app.setName('TALedit');
const profile = path.join(config.cache, 'desktop-profile');
require('node:fs').mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
let window;
const focus = () => {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show(); window.focus();
};
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', focus);
  app.whenReady().then(async () => {
    app.setAppUserModelId('it.taledit.desktop');
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
      callback(contents.getURL().startsWith(config.origin + '/') && permission === 'media');
    });
    window = new BrowserWindow({
      title: 'TALedit', width: 1680, height: 1000, minWidth: 1100, minHeight: 720,
      backgroundColor: '#0b0f19', show: false, autoHideMenuBar: true,
      icon: path.join(__dirname, 'app', 'dist', 'taledit-logo.png'),
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== config.origin) event.preventDefault();
    });
    window.once('ready-to-show', focus);
    await window.loadURL(config.origin);
    if (process.env.TALEDIT_DESKTOP_SMOKE === '1') {
      try {
        const result = await window.webContents.executeJavaScript(`({
          logo: !!document.querySelector('img[alt="Logo TALedit"]')?.complete,
          text: document.body.innerText,
        })`);
        if (!result.logo || !['TALedit','ChatGPT MCP','BG Remover','AI Cut','Pen Mask','Screenshot','VIDEO','AUDIO','COLOR'].every(label => result.text.includes(label))) {
          throw new Error('Complete desktop UI or TALedit logo missing');
        }
        require('node:fs').writeFileSync(process.env.TALEDIT_DESKTOP_SMOKE_RESULT, JSON.stringify(result));
        const screenshot = await window.webContents.capturePage();
        require('node:fs').writeFileSync(process.env.TALEDIT_DESKTOP_SMOKE_RESULT + '.png', screenshot.toPNG());
      } catch (error) {
        require('node:fs').writeFileSync(process.env.TALEDIT_DESKTOP_SMOKE_RESULT, JSON.stringify({ error: error.message }));
      }
      window.close();
    }
  }).catch(error => { console.error(error); app.quit(); });
  app.on('window-all-closed', () => {
    control(config.pipe, 'stop').finally(() => app.quit());
  });
}
