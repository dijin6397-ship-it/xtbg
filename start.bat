@echo off
chcp 65001 >nul
title Collab Platform

echo ========================================
echo       Collab Platform - Startup
echo ========================================
echo.

cd /d "%~dp0"

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

echo [1/4] Installing frontend dependencies...
if not exist "node_modules" (
    call npm install
) else (
    echo   Skipped - already installed
)

echo [2/4] Building frontend...
if not exist "dist" (
    call npx vite build
) else (
    echo   Skipped - dist folder exists
)

echo [3/4] Installing backend dependencies...
if not exist "server\node_modules" (
    cd server
    call npm install
    cd ..
) else (
    echo   Skipped - already installed
)

echo [4/4] Starting backend server...
echo.
echo ========================================
echo   URL:         http://localhost:3001
echo   Admin Panel: http://localhost:3001/admin/login
echo   Account:     admin / 123456
echo ========================================
echo.
echo Close this window or press Ctrl+C to stop.
echo.

cd server
node index.js
pause