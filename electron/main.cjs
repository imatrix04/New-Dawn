const { app, BrowserWindow } = require('electron');
const path = require('path');

// En dev, Vite sert l'interface ; en prod on charge le build.
const devUrl = process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title: 'NewDawn',
    autoHideMenuBar: true,
    fullscreen: true, // plein écran par défaut ; width/height servent quand on en sort avec F11
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // F11 : basculer entre plein écran et fenêtre (Échap est réservé au menu pause du jeu).
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });

  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
