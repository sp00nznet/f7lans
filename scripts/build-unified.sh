#!/bin/bash
# ================================================================
# F7Lans Unified Build Script (Linux)
# Builds the Electron client WITH embedded server
# All-in-one application that runs server locally
# ================================================================

echo ""
echo "  ███████╗███████╗██╗      █████╗ ███╗   ██╗███████╗"
echo "  ██╔════╝╚════██║██║     ██╔══██╗████╗  ██║██╔════╝"
echo "  █████╗      ██╔╝██║     ███████║██╔██╗ ██║███████╗"
echo "  ██╔══╝     ██╔╝ ██║     ██╔══██║██║╚██╗██║╚════██║"
echo "  ██║        ██║  ███████╗██║  ██║██║ ╚████║███████║"
echo "  ╚═╝        ╚═╝  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝"
echo ""
echo "  Unified Build (Embedded Server)"
echo "  ================================"
echo ""

# Get script directory and navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[1/5] Installing root dependencies (server)..."
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install root dependencies"
    exit 1
fi

echo ""
echo "[2/5] Installing electron-client dependencies..."
cd electron-client
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install electron-client dependencies"
    exit 1
fi

echo ""
echo "[3/5] Copying server files and installing server dependencies..."
npm run copy-server
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to copy server"
    exit 1
fi

echo ""
echo "[4/5] Building Linux application..."
npm run build:linux:unified
if [ $? -ne 0 ]; then
    echo "[ERROR] Build failed"
    exit 1
fi

echo ""
echo "[5/5] Build complete!"
echo ""
echo "================================================================"
echo "  Unified build completed successfully!"
echo ""
echo "  Find your installer in: electron-client/dist/"
echo ""
echo "  This is an all-in-one application that:"
echo "  - Runs F7Lans server locally"
echo "  - Automatically connects to localhost"
echo "  - Can be used as a headless server (--headless flag)"
echo "================================================================"
echo ""
