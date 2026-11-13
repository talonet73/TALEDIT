const { app, BrowserWindow, dialog, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let server;
let mainWindow;
let localOrigin;

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'TALedit', width: 1440, height: 960, minWidth: 1100, minHeight: 720,
    backgroundColor: '#0b0f19', show: false,
    icon: path.join(app.getAppPath(), 'dist/taledit-logo.png'),
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== localOrigin) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadURL(localOrigin);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    app.setAppUserModelId('it.taledit.desktop');
    process.env.NODE_ENV = 'production';
    process.env.TALEDIT_DESKTOP = '1';
    process.env.TALEDIT_HOST = '127.0.0.1';
    process.env.PORT = '0';
    process.env.TALEDIT_STATIC_DIR = path.join(app.getAppPath(), 'dist');
    process.env.TALEDIT_DATA_DIR = path.join(app.getPath('userData'), 'media_downloads');
    process.env.TALEDIT_FFMPEG = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
    const { startServer } = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
    server = await startServer();
    localOrigin = `http://127.0.0.1:${server.address().port}`;
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
      callback(contents.getURL().startsWith(`${localOrigin}/`) && permission === 'media');
    });
    await createWindow();
  }).catch(error => {
    dialog.showErrorBox('Impossibile avviare TALedit', error.message);
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    if (server) {
      server.closeAllConnections();
      server.close();
    }
  });
}
