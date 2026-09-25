@echo off
chcp 65001 >nul
title PEAK Automation Desktop Agent (Prime Global Asset)
color 0A

echo ===============================================================================
echo                PEAK AUTOMATION DESKTOP AGENT (Windows)
echo              Direct UI Automation for Prime Global Asset
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. Check if config.json exists
if not exist "config.json" (
    if exist "config.example.json" (
        echo [INFO] Creating config.json from template...
        copy "config.example.json" "config.json" >nul
        echo [NOTICE] Please check and update your config.json if needed.
        echo.
    )
)

:: 2. Check for pre-built standalone executable
if exist "dist\PEAKAutomationAgent.exe" (
    echo [RUN] Launching standalone executable: dist\PEAKAutomationAgent.exe
    "dist\PEAKAutomationAgent.exe"
    goto end
)

if exist "bin\Release\net8.0-windows\PEAKAutomationAgent.exe" (
    echo [RUN] Launching compiled executable: bin\Release\net8.0-windows\PEAKAutomationAgent.exe
    "bin\Release\net8.0-windows\PEAKAutomationAgent.exe"
    goto end
)

:: 3. Fallback to dotnet run
where dotnet >nul 2>nul
if %errorlevel% equ 0 (
    echo [RUN] Building and running via .NET SDK...
    dotnet run -c Release
    goto end
)

:: 4. If neither is available
color 0C
echo.
echo [ERROR] Could not find compiled PEAKAutomationAgent.exe and .NET SDK is not installed!
echo.
echo Please install .NET 8 Desktop Runtime or SDK from:
echo https://dotnet.microsoft.com/download/dotnet/8.0
echo.

:end
echo.
echo [AGENT STOPPED] Press any key to exit...
pause >nul
