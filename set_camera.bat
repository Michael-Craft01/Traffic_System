@echo off
:: ============================================================
::  SET_CAMERA.BAT — Change Phone IP in .env on the fly
::  Run this BEFORE a demo if your phone's IP has changed.
::  Usage:  set_camera.bat 192.168.1.42
::          set_camera.bat 0           <- use local webcam instead
:: ============================================================
echo.
echo  [IP CAMERA CONFIGURATOR]
echo.

if "%1"=="" (
    echo  Current camera setting:
    for /f "tokens=2 delims==" %%A in ('findstr "TRAFFIC_PHONE_IP" .env') do echo    IP  = %%A
    for /f "tokens=2 delims==" %%A in ('findstr "TRAFFIC_PHONE_PORT" .env') do echo    PORT = %%A
    echo.
    echo  Usage: set_camera.bat [IP_ADDRESS]
    echo  Example: set_camera.bat 192.168.43.101
    echo  Example: set_camera.bat 0  (to use local webcam)
    goto :end
)

set NEW_IP=%1

:: Use PowerShell to do a clean in-place replace in .env
powershell -Command "(Get-Content .env) -replace '^TRAFFIC_PHONE_IP=.*', 'TRAFFIC_PHONE_IP=%NEW_IP%' | Set-Content .env"

echo  [OK] Camera IP updated to: %NEW_IP%
echo.
if "%NEW_IP%"=="0" (
    echo  Mode: LOCAL WEBCAM
) else (
    echo  Open on your phone: http://%NEW_IP%:8080/video
    echo  (Make sure IP Webcam app is running ^& both devices are on same Wi-Fi)
)
echo.
echo  You can now run: run_system.bat

:end
pause
