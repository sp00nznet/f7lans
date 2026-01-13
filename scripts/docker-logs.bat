@echo off
REM ============================================
REM F7Lans - Docker Logs Viewer for Windows
REM ============================================

title F7Lans Docker Logs

echo.
echo  ======================================
echo   F7Lans Docker Logs
echo  ======================================
echo.
echo  Press Ctrl+C to exit log viewer
echo.

cd /d "%~dp0.."

docker-compose logs -f --tail=100

pause
