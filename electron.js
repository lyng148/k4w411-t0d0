const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 700,
        height: 550,
        frame: false, // Remove title bar and menu
        transparent: true, // Make window transparent
        backgroundColor: '#00000000', // Transparent background
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        icon: path.join(__dirname, 'public/icon.ico'), // App icon
    });

    // Handle close event from renderer
    ipcMain.on('close-app', () => {
        if (mainWindow) {
            mainWindow.close();
        }
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
