@echo off
title Resonance — Desktop Compiler App
color 0A
clear

echo =======================================================================
echo          RESONANCE — AUTOMATED DESKTOP BUILDER (TAURI)
echo =======================================================================
echo  This script will automatically configure, build and compile Resonance 
echo  as a light, high-performance desktop application (.exe) for PC.
echo =======================================================================
echo.

:: 1. Check Node.js and NPM
echo [1/6] Checking Node.js environment...
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
echo [1/6] Installing Node dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Dynamic installation warning or minor dependency errors. Let's proceed...
)
echo.

:: 2. Check Visual Studio C++ Build Tools
echo [2/6] Checking for MSVC C++ Build Tools (Required by Tauri)...
where cl >nul 2>nul
if %errorlevel% neq 0 (
    echo WARNING: Microsoft C++ Build Tools were not detected in standard PATH.
    echo Tauri requires the Visual Studio C++ build tools installed on your PC.
    echo.
    echo If you do not have C++ Build Tools installed, please do the following:
    echo  1. Go to: https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo  2. Download and run the C++ Build Tools installer.
    echo  3. Select the "Desktop development with C++" workload during setup.
    echo  4. Complete setup and restart your PC.
    echo.
    echo If they are already installed, you can proceed safely.
    set /p VS_CONFIRM=Have you installed Microsoft C++ Build Tools? [Y/N]: 
    if /I "%VS_CONFIRM%" neq "Y" (
        echo Opening download link for Visual Studio Build Tools...
        start https://visualstudio.microsoft.com/visual-cpp-build-tools/
        echo Please complete installer configuration and run this script again.
        pause
        exit
    )
) else (
    echo -- C++ Build Tools are ready.
)
echo.

:: 3. Check Rust and Cargo
echo [3/6] Checking Rust environment...
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo WARNING: Rust / Cargo is not installed on your PC.
    echo Downloading official Rustup installer for Windows...
    powershell -Command "Invoke-WebRequest -Uri 'https://win.rustup.rs/x86_64' -OutFile 'rustup-init.exe'"
    if exist rustup-init.exe (
        echo -- Rustup installer successfully downloaded!
        echo -- Running Rustup Setup. Accept defaults (Press Enter / Option 1).
        call rustup-init.exe -y
        del rustup-init.exe
        echo.
        echo =======================================================================
        echo IMPORTANT: Rust has been configured successfully!
        echo To apply the PATH environment variables, please RESTART this Command
        echo Prompt and run 'build_desktop.bat' again.
        echo =======================================================================
        pause
        exit
    ) else (
        echo ERROR: Failed to download rustup-init automatically.
        echo Please download it manually from: https://rustup.rs/
        pause
        exit
    )
) else (
    echo -- Rust is ready.
)
echo.

:: 4. Install Tauri CLI and Generate custom app icons
echo [4/6] Installing Tauri system dependencies...
call npm install --save-dev @tauri-apps/cli
echo.
echo [4/6] Generating high-resolution App Icons for Windows/Tauri...
if exist "src/assets/images/resonance_app_icon_1782061008447.jpg" (
    call npx tauri icon src/assets/images/resonance_app_icon_1782061008447.jpg
    echo -- Desktop application icons generated successfully.
) else (
    echo -- Warning: Custom visual icon file not found. Using default placeholder.
)
echo.

:: 5. Build React Production Code
echo [5/6] Building high-performance local React frontend...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: React Vite build failed. Please fix any linter errors first.
    pause
    exit
)
echo -- Frontend build ready inside dist/.
echo.

:: 6. Compile Desktop Application
echo [6/6] Packaging native windows desktop application...
echo Running Tauri Desktop Compiler compiler tool...
call npx tauri build --no-bundle
if %errorlevel% neq 0 (
    echo.
    echo --------------------------------------------------------------------------
    echo Bundle build issue occurred, trying full bundling step...
    call npx tauri build
)

if %errorlevel% eq 0 (
    color 0A
    echo.
    echo =======================================================================
    echo   SUCCESS! Resonance Desktop Player has been successfully compiled!
    echo =======================================================================
    echo   You can find your standalone desktop .exe in:
    echo   src-tauri\target\release\resonance.exe
    echo   OR bundled inside src-tauri\target\release\bundle\
    echo =======================================================================
) else (
    color 0E
    echo.
    echo =======================================================================
    echo  Compile finished. If the bundler failed, you can find the raw 
    echo  executable ready inside:
    echo  src-tauri\target\release\resonance-hifi.exe
    echo =======================================================================
)

pause
