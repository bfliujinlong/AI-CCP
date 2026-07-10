@echo off
chcp 65001 >nul
title AICC Platform Launcher
echo ========================================
echo   AICC Platform 一键启动
echo ========================================
echo.

:: 项目路径
set PROJECT_DIR=D:\Work\日常\上云迁移\01服务流程\04其他\03AI报价\04AICloudConsultingPlatform\ai-cloud-consulting-platform
set BACKEND_DIR=%PROJECT_DIR%\backend
set FRONTEND_DIR=%PROJECT_DIR%\frontend

:: Python 路径（优先系统 Python 3.8，备选 managed Python）
set PYTHON_EXE=C:\Program Files\Python38\python.exe
if not exist "%PYTHON_EXE%" set PYTHON_EXE=C:\Users\EDY\.workbuddy\binaries\python\versions\3.13.12\python.exe

:: Node 路径
set NODE_EXE=C:\Users\EDY\.workbuddy\binaries\node\versions\22.12.0\node.exe
if not exist "%NODE_EXE%" set NODE_EXE=C:\Users\EDY\.workbuddy\binaries\node\versions\22.22.2\node.exe

:: 检查端口是否被占用
echo [0/3] 检查端口占用...
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo     [警告] 端口 8000 已被占用，后端可能已在运行
    echo     如需重启，请先关闭旧的后端窗口
) else (
    echo     端口 8000 空闲
)
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo     [警告] 端口 5173 已被占用，前端可能已在运行
    echo     如需重启，请先关闭旧的前端窗口
) else (
    echo     端口 5173 空闲
)
echo.

:: 启动后端
echo [1/3] 启动后端 (FastAPI :8000)...
cd /d "%BACKEND_DIR%"
if not exist "%PYTHON_EXE%" (
    echo     [错误] 未找到 Python，请安装 Python 3.8+
    pause
    exit /b 1
)
start "AICC Backend" cmd /k "cd /d "%BACKEND_DIR%" && "%PYTHON_EXE%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: 等待后端就绪（最多 30 秒）
echo     等待后端启动...
set /a WAIT_COUNT=0
:WAIT_BACKEND
timeout /t 2 /nobreak >nul
set /a WAIT_COUNT+=1
curl -s http://127.0.0.1:8000/docs >nul 2>&1
if %errorlevel% neq 0 (
    if %WAIT_COUNT% lss 15 (
        echo     后端启动中... (%WAIT_COUNT%/15)
        goto WAIT_BACKEND
    ) else (
        echo     [警告] 后端 30 秒内未就绪，可能启动失败
        echo     请检查 AICC Backend 窗口中的错误信息
        echo     前端仍会启动（Mock 模式可独立运行）
    )
) else (
    echo     后端就绪! (用时 %WAIT_COUNT% 次/2秒)
)
echo.

:: 启动前端
echo [2/3] 启动前端 (Vite :5173)...
cd /d "%FRONTEND_DIR%"
if not exist "%NODE_EXE%" (
    echo     [错误] 未找到 Node.js
    pause
    exit /b 1
)
if not exist "%FRONTEND_DIR%\node_modules\vite\bin\vite.js" (
    echo     [错误] 前端依赖未安装，正在安装...
    cd /d "%FRONTEND_DIR%"
    call npm install
)
start "AICC Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && "%NODE_EXE%" node_modules/vite/bin/vite.js --host 0.0.0.0"

:: 等待前端就绪
echo     等待前端启动...
set /a WAIT_COUNT=0
:WAIT_FRONTEND
timeout /t 2 /nobreak >nul
set /a WAIT_COUNT+=1
curl -s http://127.0.0.1:5173 >nul 2>&1
if %errorlevel% neq 0 (
    if %WAIT_COUNT% lss 10 (
        goto WAIT_FRONTEND
    ) else (
        echo     [警告] 前端 20 秒内未就绪
    )
) else (
    echo     前端就绪!
)
echo.

:: 完成
echo [3/3] 启动完成!
echo ========================================
echo   前端: http://localhost:5173
echo   后端: http://localhost:8000/docs
echo   登录: admin / admin123
echo ========================================
echo.
echo   后端窗口标题: AICC Backend
echo   前端窗口标题: AICC Frontend
echo   关闭对应窗口即可停止服务
echo.
echo   此窗口 5 秒后自动关闭...
timeout /t 5 /nobreak >nul
