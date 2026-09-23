@echo off
echo Starting Loopader Orchestrator...
cd /d "%~dp0"

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt

echo Starting orchestrator on port 8000...
python main.py

pause