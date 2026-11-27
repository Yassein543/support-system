# YS Bot Lab Desktop

YS Bot Lab is a local AI coding workspace for Windows x64. The desktop build opens in its own app window and starts its local server automatically; users do not need to install Node.js. A portable `.exe` is available for direct launch, alongside a setup installer.

## Build the Windows installer

1. Install Node.js 20 or newer for development.
2. Run `npm install` in this directory.
3. Run `npm run dist:windows`.
4. The installer is written to `dist/YS-Bot-Lab-Setup-1.0.0.exe`.
5. To build the portable app directly, run `npm run dist:portable`; it is written to `dist/YS-Bot-Lab-Portable-1.0.0.exe`.

The installer creates Start menu and desktop shortcuts. The app's settings and workspaces live in Electron's per-user data directory, outside the installed app. Project `.env` files remain hidden from the AI file tools and file browser.

## AI provider setup

Open Settings and enter an OpenAI-compatible API URL, model name, and API key. A local model endpoint is also supported without an API key. Provider quotas, privacy terms, and charges are controlled by that provider.

## Android

The Windows installer is not an Android app. The repository still contains a Termux startup script, but this release does not include an Android APK.

The three-day launch offer is promotional copy only in this early release; no license server or automatic expiration is included.
