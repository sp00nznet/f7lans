@echo off
REM ================================================================
REM F7Lans Unified Build Script (Windows)
REM Builds the Electron client WITH embedded server
REM All-in-one application that runs server locally
REM ================================================================

echo.
echo   ███████╗███████╗██╗      █████╗ ███╗   ██╗███████╗
echo   ██╔════╝╚════██║██║     ██╔══██╗████╗  ██║██╔════╝
echo   █████╗      ██╔╝██║     ███████║██╔██╗ ██║███████╗
echo   ██╔══╝     ██╔╝ ██║     ██╔══██║██║╚██╗██║╚════██║
echo   ██║        ██║  ███████╗██║  ██║██║ ╚████║███████║
echo   ╚═╝        ╚═╝  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝
echo.
echo   Unified Build (Embedded Server)
echo   ================================
echo.

REM Get script directory and navigate to project root
cd /d "%~dp0.."

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

echo [1/5] Installing root dependencies (server)...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install root dependencies
    exit /b 1
)

echo.
echo [2/5] Installing electron-client dependencies...
cd electron-client
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install electron-client dependencies
    exit /b 1
)

echo.
echo [3/5] Copying server files and installing server dependencies...
call npm run copy-server
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to copy server
    exit /b 1
)

echo.
echo [4/5] Building Windows application...
call npm run build:win:unified
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed
    exit /b 1
)

echo.
echo [5/5] Build complete!
echo.
echo ================================================================
echo   Unified build completed successfully!
echo.
echo   Find your installer in: electron-client\dist\
echo.
echo   This is an all-in-one application that:
echo   - Runs F7Lans server locally
echo   - Automatically connects to localhost
echo   - Can be used as a headless server (--headless flag)
echo ================================================================
echo.
