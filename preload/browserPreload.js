const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('browser', {
    back: () => ipcRenderer.send('browserBar-back'),
    forward: () => ipcRenderer.send('browserBar-forward'),
    reload: () => ipcRenderer.send('browserBar-reload'),
    minimize: () => ipcRenderer.send('browserBar-minimize'), 
    maximize: () => ipcRenderer.send('browserBar-maximize'),
    close: () => ipcRenderer.send('browserBar-close'),

    createTab: (tabIndex) => ipcRenderer.send('create-tab', tabIndex),
    changeTab: (tabIndex) => ipcRenderer.send('change-tab', tabIndex),
    deleteTab: (tabIndex) => { return ipcRenderer.invoke('delete-tab', tabIndex) },

    onTabTitleChange: (callback) => ipcRenderer.on('change-tab-title', callback)
})