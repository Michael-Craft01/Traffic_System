@echo off
echo Starting Traffic System...

start "Next.js Dashboard" cmd /k "npm run dev"
echo Dashboard launched on http://localhost:3000

echo Starting AI Engine...
echo (Press 'q' in the video window to stop detection)
py traffic_engine/detector.py

pause
