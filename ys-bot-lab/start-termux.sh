#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js in Termux..."
  pkg install nodejs -y
fi
node server.js
