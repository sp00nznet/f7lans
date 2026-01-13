@echo off
REM ============================================
REM F7Lans - Start Server Script for Windows
REM ============================================

title F7Lans Server

echo.
echo  ======================================
echo   F7Lans Server
echo  ======================================
echo.

cd /d "%~dp0.."

REM Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] Dependencies not installed!
    echo Please run setup.bat first.
    pause
    exit /b 1
)

REM Check for .env file
if not exist ".env" (
    echo [WARNING] No .env file found!
    echo Creating from template...
    copy ".env.example" ".env" >nul
    echo [IMPORTANT] Please edit .env with your configuration!
    echo.
)

echo Starting F7Lans server...
echo Press Ctrl+C to stop the server.
echo.

REM Start the server
node server\index.js

pause
