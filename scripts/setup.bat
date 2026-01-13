@echo off
REM ============================================
REM F7Lans - Complete Setup Script for Windows
REM ============================================
REM This script sets up the entire F7Lans project
REM including server, web client, and Electron client
REM ============================================

title F7Lans Setup

echo.
echo  ======================================
echo   F7Lans Gaming Community Platform
echo   Windows Setup Script
echo  ======================================
echo.

REM Check for Node.js
echo [1/6] Checking for Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    echo Recommended version: 20.x LTS
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo        Found Node.js %%i

REM Check for npm
echo [2/6] Checking for npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed!
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do echo        Found npm %%i

REM Install server dependencies
echo [3/6] Installing server dependencies...
cd /d "%~dp0.."
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install server dependencies!
    pause
    exit /b 1
)
echo        Server dependencies installed successfully

REM Install Electron client dependencies
echo [4/6] Installing Electron client dependencies...
cd /d "%~dp0..\electron-client"
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install Electron client dependencies!
    pause
    exit /b 1
)
echo        Electron client dependencies installed successfully

REM Create .env file if it doesn't exist
echo [5/6] Setting up environment configuration...
cd /d "%~dp0.."
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo        Created .env file from template
    echo        [IMPORTANT] Please edit .env with your configuration!
) else (
    echo        .env file already exists
)

REM Create uploads directory
echo [6/6] Creating required directories...
if not exist "server\uploads\avatars" mkdir "server\uploads\avatars"
echo        Created uploads directory

echo.
echo  ======================================
echo   Setup Complete!
echo  ======================================
echo.
echo  Next steps:
echo  1. Edit .env file with your MongoDB connection
echo  2. Run 'scripts\start-server.bat' to start the server
echo  3. Run 'scripts\build-electron.bat' to build the desktop client
echo.
pause
