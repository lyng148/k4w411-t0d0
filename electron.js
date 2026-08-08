const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 700,
        height: 550,
        minWidth: 400,
        minHeight: 400,
        resizable: true,
        frame: false, // Remove title bar and menu
        transparent: true, // Make window transparent
        backgroundColor: '#00000000', // Transparent background
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, 'public/icon.ico'), // App icon
    });

    // Handle close event from renderer (closes ONLY the target window sending event)
    ipcMain.on('close-app', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
            win.close();
        }
    });

    // Handle minimize event from renderer
    ipcMain.on('minimize-app', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
            win.minimize();
        }
    });

    // Handle maximize/restore event from renderer
    ipcMain.on('maximize-app', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win && !win.isDestroyed()) {
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        }
    });

    // Handle opening standalone sticky note window
    ipcMain.on('open-standalone-note', (event, data) => {
        const noteWindow = new BrowserWindow({
            width: 320,
            height: 380,
            minWidth: 240,
            minHeight: 220,
            resizable: true,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            alwaysOnTop: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
            },
            icon: path.join(__dirname, 'public/icon.ico'),
        });

        noteWindow.loadFile(path.join(__dirname, 'dist/index.html'), {
            query: { standaloneGroup: data.groupId }
        });
    });

    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('maximize-state-changed', true);
    });

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('maximize-state-changed', false);
    });

    // Load the built app
    mainWindow.loadFile('dist/index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
