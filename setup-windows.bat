@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo Saarthi local setup
echo ===================

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found.
  where winget >nul 2>&1
  if errorlevel 1 (
    echo Install Node.js 20.19+ from https://nodejs.org/ and run this file again.
    pause
    exit /b 1
  )
  echo Installing Node.js LTS with winget...
  winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo Node.js installation failed. Install it from https://nodejs.org/
    pause
    exit /b 1
  )
  echo Node.js was installed. Close this window, open a new terminal, and run setup-windows.bat again.
  pause
  exit /b 0
)

where pnpm >nul 2>&1
if errorlevel 1 (
  where corepack >nul 2>&1
  if errorlevel 1 (
    echo Neither pnpm nor Node.js Corepack was found.
    echo Install or reinstall Node.js LTS from https://nodejs.org/
    echo Then close and reopen this window.
    pause
    exit /b 1
  )
  set "PNPM_CMD=corepack pnpm"
) else (
  set "PNPM_CMD=pnpm"
)

set /p DATABASE_URL=Enter your PostgreSQL DATABASE_URL: 
if "%DATABASE_URL%"=="" (
  echo DATABASE_URL is required.
  pause
  exit /b 1
)

echo.
echo Installing project dependencies...
call %PNPM_CMD% install
if errorlevel 1 (
  echo Dependency installation failed.
  pause
  exit /b 1
)

echo.
echo Creating or updating database tables...
set "DATABASE_URL=%DATABASE_URL%"
call %PNPM_CMD% --filter @workspace/db run push
if errorlevel 1 (
  echo Database setup failed. Check PostgreSQL and DATABASE_URL.
  pause
  exit /b 1
)

echo.
echo Starting the API and frontend in separate windows...
start "Saarthi API" /D "%~dp0" cmd /k "set DATABASE_URL=%DATABASE_URL%&& set PORT=5000&& %PNPM_CMD% --filter @workspace/api-server run dev"
start "Saarthi Web" /D "%~dp0" cmd /k "set PORT=5173&& set BASE_PATH=/&& %PNPM_CMD% --filter @workspace/finance-advisor run dev"

timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Saarthi is starting at http://localhost:5173
echo Keep both terminal windows open while using the app.
pause