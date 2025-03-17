@echo off
title Outlook MCP Server
cd /d "%~dp0"

:start
echo Starting Outlook MCP Server...
node "%~dp0\src\index.js"
if errorlevel 1 (
    echo Server crashed, restarting in 3 seconds...
    timeout /t 3 /nobreak >nul
    goto start
)