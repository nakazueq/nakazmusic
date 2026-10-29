@echo off
rem Sonara: closes the player, rebuilds the exe and puts Sonara.exe one level up (next to the src folder)
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install it: winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)

echo Closing the player...
taskkill /f /im Sonara.exe >nul 2>&1
taskkill /f /im MyPlayer.exe >nul 2>&1

if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :fail
)

node tools\build.mjs || goto :fail

echo.
echo Done: %~dp0..\Sonara.exe
exit /b 0

:fail
echo.
echo BUILD FAILED
pause
exit /b 1
