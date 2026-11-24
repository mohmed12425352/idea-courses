@echo off
chcp 65001 > nul
title سيرفر منصة المحاضرات - بشمهندس ميدو شلبي (C# .NET 9)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Platform.ps1"
pause
