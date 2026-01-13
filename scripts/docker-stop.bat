@echo off
REM ============================================
REM F7Lans - Docker Stop Script for Windows
REM ============================================

title F7Lans Docker Stop

echo.
echo  ======================================
echo   F7Lans Docker Stop
echo  ======================================
echo.

cd /d "%~dp0.."

echo Stopping F7Lans containers...

docker-compose down

echo.
echo  Containers stopped.
echo.

pause
