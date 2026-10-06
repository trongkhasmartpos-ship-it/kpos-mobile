@echo off
setlocal
cd /d "%~dp0"
set "TARGET=%LOCALAPPDATA%\KPOS\PrintAgent"
if not exist "%TARGET%" mkdir "%TARGET%"
copy /Y "%~dp0KPOS-Print-Agent.ps1" "%TARGET%\KPOS-Print-Agent.ps1" >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "KPOSPrintAgent" /t REG_SZ /d "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%TARGET%\KPOS-Print-Agent.ps1\"" /f >nul
start "KPOS Print Agent" powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%TARGET%\KPOS-Print-Agent.ps1"
echo.
echo KPOS Print Agent da duoc cai tu khoi dong cung Windows.
echo Agent: http://127.0.0.1:17654
pause
