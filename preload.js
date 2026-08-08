const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    closeApp: () => ipcRenderer.send('close-app'),
    maximizeApp: () => ipcRenderer.send('maximize-app'),
    minimizeApp: () => ipcRenderer.send('minimize-app'),
    openStandaloneNote: (groupId) => ipcRenderer.send('open-standalone-note', { groupId }),
    onMaximizeStateChange: (callback) => ipcRenderer.on('maximize-state-changed', (event, isMaximized) => callback(isMaximized)),
});
