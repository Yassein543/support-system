'use strict';

const { app, BrowserWindow, dialog, shell } = require('electron');
const net = require('node:net');
const path = require('node:path');

if (!app.requestSingleInstanceLock()) app.quit();
else {
    let mainWindow;
    let appOrigin = '';

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
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        });

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
    }

    startApp().catch((error) => {
        dialog.showErrorBox('YS Bot Lab', error.message);
        app.quit();
    });

    app.on('window-all-closed', () => app.quit());
}
