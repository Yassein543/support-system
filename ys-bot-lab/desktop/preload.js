'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ysLabDesktop', Object.freeze({
    chooseProjectFolder: () => ipcRenderer.invoke('ys-lab:choose-project-folder'),
    checkForUpdates: () => ipcRenderer.invoke('ys-lab:check-updates')
}));
