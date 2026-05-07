@echo off
:: ============================================================
::  TRAFFIC COMMAND CENTER — Demo Launcher
::  Reads .env automatically — just update .env before demos.
:: ============================================================
echo.
echo  ██████████████████████████████████████████████
echo  ██  TRAFFIC AI COMMAND CENTER  v1.0          ██
echo  ██████████████████████████████████████████████
echo.

:: --- Step 1: Load variables from .env ---
echo [1/3] Loading environment config from .env...
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /v "^#" .env`) do (
    set "%%A=%%B"
)

:: --- Step 2: Show what camera source will be used ---
echo.
if "%TRAFFIC_PHONE_IP%"=="0" (
    echo  [CAM] Source: LOCAL WEBCAM (device 0)
) else (
    echo  [CAM] Source: PHONE IP CAMERA  ^>  http://%TRAFFIC_PHONE_IP%:%TRAFFIC_PHONE_PORT%/video
)
echo  [API] Backend: %BACKEND_URL%
echo.

:: --- Step 3: Launch Frontend Dashboard in a new window ---
echo [2/3] Starting Next.js Dashboard...
start "Traffic Dashboard" cmd /k "npm run dev"
echo  Dashboard will be ready at: http://localhost:3000

:: --- Step 4: Brief pause so the dashboard window opens ---
timeout /t 2 /nobreak >nul

:: --- Step 5: Start Backend ---
echo [3/3] Starting Traffic Director Backend...
cd backend
start "Traffic Backend" cmd /k "py main.py"
cd ..

pause
