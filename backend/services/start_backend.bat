@echo off
REM Windows Batch Script to Start Backend
REM This prevents terminal hangs by using the safe startup script

echo ================================================
echo AI-Powered CRM Backend Startup
echo ================================================
echo.
echo Activating virtual environment...

REM Activate venv from project root (2 levels up)
call "%~dp0\..\..\.\.venv\Scripts\activate.bat"

if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment
    echo Please create venv: python -m venv .venv
    pause
    exit /b 1
)

echo [OK] Virtual environment activated
echo.

REM Change to the services directory
cd /d "%~dp0"

REM Use Python to run the safe startup script with venv
python windows_safe_start.py

REM Pause if there's an error
if errorlevel 1 (
    echo.
    echo [ERROR] Backend failed to start
    pause
)
