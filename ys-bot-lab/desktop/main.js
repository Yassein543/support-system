'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const net = require('node:net');
const path = require('node:path');

if (!app.requestSingleInstanceLock()) app.quit();
else {
    let mainWindow;
    let appOrigin = '';
    let updateCheckManual = false;
    let updateDialogOpen = false;

    app.on('second-instance', () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });

    function reservePort() {
        return new Promise((resolve, reject) => {
            const probe = net.createServer();
            probe.once('error', reject);
            probe.listen(0, '127.0.0.1', () => {
                const port = probe.address().port;
                probe.close((error) => error ? reject(error) : resolve(port));
            });
        });
    }

    function canAutoUpdate() {
        return app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR && process.platform === 'win32';
    }

    async function checkForUpdates(manual = false) {
        if (!canAutoUpdate()) {
            if (manual) await dialog.showMessageBox(mainWindow, {
                type: 'info', title: 'YS Bot Lab updates',
                message: 'Install the Windows Setup version once to receive updates inside the app. The portable copy cannot replace itself while it is running.'
            });
            return;
        }
        updateCheckManual = manual;
        try { await autoUpdater.checkForUpdates(); }
        catch (error) {
            updateCheckManual = false;
            if (manual) await dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Update check failed', message: error.message });
        }
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('update-available', async (info) => {
        if (updateDialogOpen || !mainWindow) return;
        updateDialogOpen = true;
        const choice = await dialog.showMessageBox(mainWindow, {
            type: 'info', title: 'YS Bot Lab update available',
            message: `Version ${info.version} is ready. Download and install it now?`,
            buttons: ['Download update', 'Later'], defaultId: 0, cancelId: 1
        });
        updateDialogOpen = false;
        updateCheckManual = false;
        if (choice.response === 0) {
            try { await autoUpdater.downloadUpdate(); }
            catch (error) { await dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Update download failed', message: error.message }); }
        }
    });
    autoUpdater.on('update-not-available', async () => {
        if (!updateCheckManual || !mainWindow) return;
        updateCheckManual = false;
        await dialog.showMessageBox(mainWindow, { type: 'info', title: 'YS Bot Lab', message: 'You already have the latest version.' });
    });
    autoUpdater.on('update-downloaded', async (info) => {
        if (!mainWindow) return;
        const choice = await dialog.showMessageBox(mainWindow, {
            type: 'info', title: 'Update downloaded',
            message: `Version ${info.version} has been downloaded. Restart the app to finish updating.`,
            buttons: ['Restart and install', 'Later'], defaultId: 0, cancelId: 1
        });
        if (choice.response === 0) autoUpdater.quitAndInstall(false, true);
    });
    autoUpdater.on('download-progress', (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle(`YS Bot Lab — downloading update ${Math.round(progress.percent)}%`);
    });
    autoUpdater.on('error', (error) => console.warn('[YS Bot Lab updater]', error.message));

    async function waitForServer(url) {
        let lastError;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            try {
                const response = await fetch(`${url}/api/bootstrap`, { signal: AbortSignal.timeout(1500) });
                if (response.ok) return;
                lastError = new Error(`Local server returned HTTP ${response.status}.`);
            } catch (error) { lastError = error; }
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
        throw lastError || new Error('The local server did not start.');
    }

    async function startApp() {
        await app.whenReady();
        const port = await reservePort();
        process.env.PORT = String(port);
        process.env.YS_BOT_LAB_HOME = app.getPath('userData');
        process.env.YS_BOT_LAB_PACKAGED = app.isPackaged ? '1' : '0';
        appOrigin = `http://127.0.0.1:${port}`;
        require(path.join(__dirname, '..', 'server.js'));

        try { await waitForServer(appOrigin); }
        catch (error) {
            dialog.showErrorBox('YS Bot Lab could not start', `${error.message}\n\nRestart the app. If the problem continues, reinstall it.`);
            app.quit();
            return;
        }

        mainWindow = new BrowserWindow({
            width: 1360,
            height: 900,
            minWidth: 760,
            minHeight: 600,
            show: false,
            autoHideMenuBar: true,
            title: 'YS Bot Lab',
            backgroundColor: '#080d0b',
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        });

        ipcMain.handle('ys-lab:choose-project-folder', async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
                title: 'Open an existing project folder',
                properties: ['openDirectory', 'createDirectory']
            });
            if (result.canceled || !result.filePaths[0]) return null;
            return result.filePaths[0];
        });
        ipcMain.handle('ys-lab:check-updates', () => checkForUpdates(true));

        mainWindow.once('ready-to-show', () => mainWindow.show());
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (/^https?:\/\//i.test(url)) shell.openExternal(url);
            return { action: 'deny' };
        });
        mainWindow.webContents.on('will-navigate', (event, url) => {
            if (!url.startsWith(appOrigin)) event.preventDefault();
        });
        mainWindow.on('closed', () => { mainWindow = null; });
        await mainWindow.loadURL(appOrigin);
        setTimeout(() => checkForUpdates(false), 5000);
    }

    startApp().catch((error) => {
        dialog.showErrorBox('YS Bot Lab', error.message);
        app.quit();
    });

    app.on('window-all-closed', () => app.quit());
}
