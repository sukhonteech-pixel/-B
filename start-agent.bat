@echo off
chcp 65001 >nul
title PEAK Automation Desktop Agent Launcher
cd /d "%~dp0windows-agent\PEAKAutomationAgent"
call start-agent.bat
