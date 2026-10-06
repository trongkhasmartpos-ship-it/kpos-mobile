@echo off
cd /d "%~dp0"
title KPOS Print Agent LAN-WiFi
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0KPOS-Print-Agent.ps1"
pause
