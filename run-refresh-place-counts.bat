@echo off
setlocal EnableExtensions
title Naver Place Count Refresh

cd /d "%~dp0"
set "SERVICE_ACCOUNT_PATH=%~dp0.secrets\nfs-gourmet-firebase-adminsdk-fbsvc-0f63cb1508.json"
goto :run

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 20 or later and try again.
  goto :end
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pnpm was not found.
  echo Run "corepack enable" and "corepack prepare pnpm@latest --activate", then try again.
  goto :end
)

if "%~1"=="" (
  set /p "SERVICE_ACCOUNT_PATH=Enter the Firebase service-account JSON path: "
) else (
  set "SERVICE_ACCOUNT_PATH=%~1"
)

if "%SERVICE_ACCOUNT_PATH%"=="" (
  echo [CANCELLED] A service-account JSON path is required.
  goto :end
)

if not exist "%SERVICE_ACCOUNT_PATH%" (
  echo [ERROR] File not found: "%SERVICE_ACCOUNT_PATH%"
  goto :end
)

if not exist "node_modules" (
  echo.
  echo [SETUP] Installing JavaScript packages...
  call pnpm install --no-frozen-lockfile --node-linker=hoisted
  if errorlevel 1 goto :install_error

  echo [SETUP] Installing Chromium. This is only needed once...
  call pnpm exec playwright install chromium
  if errorlevel 1 goto :install_error
)

:run
echo.
if /I "%~1"=="--dry-run" (
  set "RUN_MODE=Y"
) else (
  set "RUN_MODE=N"
)
if /I "%RUN_MODE%"=="N" (
  echo.
  echo [RUN] Writing place counts to Firestore.
  node scripts\refresh-naver-place-counts.mjs --service-account "%SERVICE_ACCOUNT_PATH%"
) else (
  echo.
  echo [DRY RUN] Fetching place counts without writing to Firestore.
  node scripts\refresh-naver-place-counts.mjs --service-account "%SERVICE_ACCOUNT_PATH%" --dry-run
)

if errorlevel 1 (
  echo.
  echo [FAILED] Check the error message above.
) else (
  echo.
  echo [DONE] The job has finished.
)
goto :end

:install_error
echo.
echo [ERROR] Setup failed. Check your internet connection and pnpm configuration.

:end
echo.
if not defined NO_PAUSE pause
endlocal
