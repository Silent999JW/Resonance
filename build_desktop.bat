@echo off
title Resonance — Desktop Compiler App
color 0A
cls

echo =======================================================================
echo          RESONANCE — AUTOMATED DESKTOP BUILDER (ELECTRON)
echo =======================================================================
echo  This script will automatically configure, build and compile Resonance 
echo  as a light, high-performance desktop application (.exe) for Windows.
echo =======================================================================
echo.

:: 1. Check Node.js and NPM
echo [1/3] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Node.js is not installed or not in your system PATH!
    echo   Please download and install Node.js from: https://nodejs.org/
    echo   After installing Node.js, reopen this script.
    pause
    exit
)
echo -- Node.js is ready.
echo [1/3] Installing/updating project dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Dynamic installation warning or minor dependency errors. Let's proceed...
)
echo.

:: 2. Build React Production Code
echo [2/3] Building high-performance local React frontend...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: React Vite build failed. Please fix any compiler errors first.
    pause
    exit
)
echo -- Frontend build ready inside dist/.
echo.

:: 3. Compile Desktop Application
echo [3/3] Packaging native Windows desktop application (Installer + Portable)...
echo Running Electron-Builder compiler tools...
call npx electron-builder --win
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Electron compile failed!
    pause
    exit
)

color 0A
echo.
echo =======================================================================
echo   SUCCESS! Resonance Desktop Player has been successfully compiled!
echo =======================================================================
echo   You can find your standalone desktop components inside:
echo   dist-desktop\
echo.
echo   - NSIS Setup Installer:
echo     dist-desktop\Resonance Setup 1.2.0.exe
echo.
echo   - Standalone Portable Executable:
echo     dist-desktop\Resonance 1.2.0.exe
echo =======================================================================
echo.

pause
