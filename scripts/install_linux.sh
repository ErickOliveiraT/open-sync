#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BINARY="$PROJECT_DIR/release/linux-unpacked/open-sync"
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$DESKTOP_DIR/open-sync.desktop"

echo "==> Building OpenSync..."
cd "$PROJECT_DIR"
npm run dist

echo "==> Setting executable permission..."
chmod +x "$BINARY"

echo "==> Creating app menu entry..."
mkdir -p "$DESKTOP_DIR"
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=OpenSync
Comment=Open Sync App
Exec=$BINARY --no-sandbox --disable-gpu
Icon=utilities-file-archiver
Type=Application
Categories=Utility;
StartupNotify=true
EOF

echo "==> Updating desktop database..."
update-desktop-database "$DESKTOP_DIR"

echo ""
echo "Done! OpenSync is now available in your app menu."
