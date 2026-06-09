@echo off
echo ========================================
echo    WorkTrack - Start All Services
echo ========================================
echo.
echo Starting all services (backend + frontend)
start "WorkTrack All" cmd /k "cd /d "%~dp0" && npm run dev"
echo.
echo Done! Check the terminal window that opened.
