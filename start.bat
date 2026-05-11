@echo off
chcp 65001 >nul
setlocal

REM ============================================================
REM  FARA - launch backend and frontend in two PowerShell windows
REM ============================================================

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo.
echo === FARA Avtoperevozki - launcher ===
echo Root: %ROOT%
echo.

REM --- First run: create venv and install deps ---
if not exist "%BACKEND%\.venv\Scripts\Activate.ps1" (
    echo [setup] Creating virtualenv...
    pushd "%BACKEND%"
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create venv. Is Python installed and in PATH?
        popd
        pause
        exit /b 1
    )
    echo [setup] Installing dependencies...
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
    popd
)

REM --- .env (copy from example if missing) ---
if not exist "%BACKEND%\.env" (
    if exist "%BACKEND%\.env.example" (
        copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul
        echo [setup] .env created from .env.example - edit if needed.
    )
)

REM --- Backend window (call venv python directly to avoid ExecutionPolicy issue) ---
echo [run] Backend  -^> http://localhost:8000  (Swagger: /docs)
start "FARA Backend (FastAPI :8000)" powershell -NoExit -ExecutionPolicy Bypass -Command ^
  "cd '%BACKEND%'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

REM --- Frontend window ---
echo [run] Frontend -^> http://localhost:8080  (admin: /admin/)
start "FARA Frontend (static :8080)" powershell -NoExit -Command ^
  "cd '%FRONTEND%'; python -m http.server 8080"

REM --- Wait a bit and open browser ---
timeout /t 3 /nobreak >nul
start "" "http://localhost:8080/"

echo.
echo Done. Two server windows opened - close them to stop the servers.
echo.
endlocal
