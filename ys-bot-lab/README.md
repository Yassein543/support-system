# YS Bot Lab Desktop

YS Bot Lab is a local AI coding workspace for Windows x64. The desktop build opens in its own app window and starts its local server automatically; users do not need to install Node.js. A portable `.exe` is available for direct launch, alongside a setup installer.

## Build the Windows installer

1. Install Node.js 20 or newer for development.
2. Run `npm install` in this directory.
3. Run `npm run dist:windows`.
4. The installer is written to `dist-v107/YS-Bot-Lab-Setup-1.0.7.exe`.
5. To build the portable app directly, run `npm run dist:portable`; it is written to `dist-v107/YS-Bot-Lab-Portable-1.0.7.exe`.

The installer creates Start menu and desktop shortcuts. Install this version once to get in-app update checks from public GitHub releases; the portable EXE cannot update itself. The app's settings and workspaces live in Electron's per-user data directory, outside the installed app. Use **New** to create a project in the app workspace, or **Open folder** to work on an existing directory in place. Opened folders are remembered for this Windows account. Project `.env` files remain hidden from the AI file tools and file browser.

The assistant has Programming, Video & Ads, Web Search (Wikipedia and GitHub), and Defensive Security modes. Version 1.0.7 adds a manual video editor: import video, image, and audio; arrange, trim, and split clips; preview the sequence; set aspect ratio and resolution; add a dissolve, background music, title overlay, and color adjustments; then export an MP4 locally. FFmpeg is bundled with the Windows installer, so users do not need a separate install. Limits are 30 timeline items, 10 minutes total, and 500 MB per imported file.

Video & Ads sends the user's description directly to Gemini Omni 1.2 Flash, generates an MP4, previews it in the chat, and saves it into the selected project. Every request shows an estimated cost and asks for confirmation first. Official estimated video rates are about $0.023/sec at 360p, $0.07/sec at 720p, and $0.104/sec at 1080p; actual billing may vary. Video generation needs an API key and a paid Gemini API account. A minor should ask the billing account holder before adding a key or enabling billing. The app stores the key in its local settings `.env`, separate from project `.env` files. Security mode is limited to defensive work and does not let the AI request terminal commands.

## AI provider setup

Open Settings and enter an OpenAI-compatible API URL, model name, and API key for coding chat. To generate videos, separately add a Gemini API key in the video key field. Do not share API keys in chat or source files. Provider quotas, privacy terms, and charges are controlled by that provider.

## Android

The Windows installer is not an Android app. The repository still contains a Termux startup script, but this release does not include an Android APK.

The three-day launch offer is promotional copy only in this early release; no license server or automatic expiration is included.

Version 1.0.7 adds everyday chat mode, new chat sessions, inline command output, live terminal polling with input and stop controls, safer external project matching, and non-destructive creation of new files. Commands still require explicit approval and run from the selected project folder.

Version 1.0.8 improves file and folder creation in the tree, adds confirmed file and folder deletion, and makes the update button install available Setup updates in-app and restart automatically.
