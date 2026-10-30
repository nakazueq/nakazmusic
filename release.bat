@echo off
rem nakazmusic: builds nakazmusic.exe from scratch and packs ..\release\nakazmusic-<version>-win-x64.zip (+ .sha256)
setlocal
cd /d "%~dp0"
call "%~dp0build.bat" || exit /b 1
node tools\release.mjs || (echo RELEASE FAILED & pause & exit /b 1)
exit /b 0
