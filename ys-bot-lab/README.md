# YS Bot Lab

A local, responsive AI coding workspace. It creates and edits files only inside the selected project folder. AI-requested shell commands are shown first and run only after you approve them.

## Start on Windows

1. Install Node.js 20 or later.
2. Extract this folder.
3. Double-click `start-windows.bat`, or run `node server.js` in PowerShell from this folder.
4. Open `http://127.0.0.1:3210`.
5. Open Settings and enter an OpenAI-compatible API URL, model name, and API key. For a local model server, use its local URL; a key is optional for localhost.

## Start on Android with Termux

1. Install Termux from its official F-Droid or GitHub distribution.
2. Extract the project into a Termux-accessible folder. In Termux, install Node.js with `pkg install nodejs` if needed.
3. Run `bash start-termux.sh` from the extracted folder.
4. Open `http://127.0.0.1:3210` in the phone browser.

## Included

- Arabic and English interface
- Project/workspace creation
- Folder tree and local code editor
- AI file/folder tools scoped to the selected workspace
- Hidden local `.env` form for project secrets
- Approval prompt before every terminal command
- Local terminal output and command status
- OpenAI-compatible providers, including local HTTP endpoints

## Local data and secrets

- AI provider settings are saved in this app folder's `.env` and `settings.json`.
- Project secrets are saved in that project's hidden `.env` file.
- `.env` files are excluded from AI file tools, the file tree, and `.gitignore`.
- Workspaces are stored under `.workspaces/` next to the app.
- The server listens on `127.0.0.1` only and is not exposed to the local network.
- No AI provider API key is included. Add your own key in Settings, or use a local model endpoint.

This is an early build. Keep backups of important project files and review generated code and commands before using them.

The launch offer is advertised as a three-day free trial. This downloadable build does not include a license server or enforce an expiration date; adding a real time-limited trial would require an online licensing service. AI provider usage may still be billed by that provider.
