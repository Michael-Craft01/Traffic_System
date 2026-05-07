@echo off
:: ============================================================
::  TRAFFIC COMMAND CENTER — Master "One-Click" Launcher
:: ============================================================
echo.
echo  ██████████████████████████████████████████████
echo  ██  TRAFFIC AI COMMAND CENTER  v1.0          ██
echo  ██████████████████████████████████████████████
echo.

:: --- IP CONFIGURATION PROMPT ---
set /p USER_IP="[SETUP] Enter Camera IP (Press Enter for default 192.168.1.128): "
if "%USER_IP%"=="" set USER_IP=192.168.1.128
set TRAFFIC_PHONE_IP=%USER_IP%

echo.
echo  [SYSTEM] Initializing AI Traffic Orchestration on %TRAFFIC_PHONE_IP%...
echo.

:: 1. Start the Backend API (Hidden window)
echo  [1/4] Starting Traffic Backend...
cd backend
start "Traffic Backend" /min cmd /k "py main.py"
cd ..

:: 2. Start the AI Vision Node (Visible Window)
echo  [2/4] Starting YOLOv8 Vision Engine...
start "YOLO Vision Node" cmd /k "set TRAFFIC_PHONE_IP=%TRAFFIC_PHONE_IP% && py traffic_engine/detector.py"

:: 3. Start the Next.js Dashboard
echo  [3/4] Starting Web Interface...
start "Traffic Dashboard" /min cmd /k "npm run dev -- -p 3001"

:: 4. Launch the Browser Automatically
echo  [4/4] Launching Dashboard in Browser...
timeout /t 5 /nobreak >nul
start http://localhost:3001

echo.
echo  ============================================================
echo   [READY] System is now running! 
echo   - Close the YOLO window to stop detection.
echo   - Close this terminal to stop the entire system.
echo  ============================================================
echo.
pause
