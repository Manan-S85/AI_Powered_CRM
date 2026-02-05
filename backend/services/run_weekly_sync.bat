@echo off
REM Weekly CRM Data Sync - Windows Task Scheduler Script
REM Run this script via Windows Task Scheduler every week

cd /d "d:\VS Code\AI_Powered_CRM\backend\services"
"D:/VS Code/AI_Powered_CRM/.venv/Scripts/python.exe" weekly_sync.py --run-now

pause