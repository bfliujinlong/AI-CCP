@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

title AICC Platform Launcher

:: ============================================================
::   AICC 平台启动器 v2.0
::   支持: 一键启停 / 本地后端 / 远程后端 / 浏览器自动打开
:: ============================================================

set "PROJECT_DIR=D:\Work\日常\上云迁移\01服务流程\04其他\03AI报价\04AICloudConsultingPlatform\ai-cloud-consulting-platform"
set "BACKEND_DIR=%PROJECT_DIR%\backend"
set "FRONTEND_DIR=%PROJECT_DIR%\frontend"
set "CLOUD_BACKEND=http://8.153.152.218:8000"
set "CLOUD_FRONTEND=http://8.153.152.218"
set "LOCAL_BACKEND=http://127.0.0.1:8000"
set "LOCAL_FRONTEND=http://127.0.0.1:5173"

:: 路径回退
set "PYTHON_EXE=C:\Program Files\Python38\python.exe"
if not exist "!PYTHON_EXE!" set "PYTHON_EXE=C:\Users\EDY\.workbuddy\binaries\python\versions\3.13.12\python.exe"
set "NODE_EXE=C:\Users\EDY\.workbuddy\binaries\node\versions\22.12.0\node.exe"
if not exist "!NODE_EXE!" set "NODE_EXE=C:\Users\EDY\.workbuddy\binaries\node\versions\22.22.2\node.exe"

:: ============================================================
::   菜单
:: ============================================================
:MENU
cls
echo.
echo  ============================================================
echo      AICC 平台启动器 v2.0
echo  ============================================================
echo.
echo   [1] 启动本地版（前端 + 后端，前后端都在本机）
echo   [2] 启动前端 + 远程后端（前端本地 + 复用云端 8.153.152.218）
echo   [3] 仅启动前端（Mock 模式，不需要后端）
echo   [4] 仅启动后端
echo   [5] 停止本地服务（关闭 8000/5173 端口）
echo   [6] 查看服务状态
echo   [7] 打开云端平台（http://8.153.152.218）
echo   [0] 退出
echo.
echo  ============================================================
echo.
set /p CHOICE=  请选择 [0-7]:

if "%CHOICE%"=="1" goto START_LOCAL
if "%CHOICE%"=="2" goto START_FRONT_REMOTE_BACKEND
if "%CHOICE%"=="3" goto START_FRONTEND_ONLY
if "%CHOICE%"=="4" goto START_BACKEND_ONLY
if "%CHOICE%"=="5" goto STOP_ALL
if "%CHOICE%"=="6" goto STATUS
if "%CHOICE%"=="7" goto OPEN_CLOUD
if "%CHOICE%"=="0" exit /b 0
goto MENU

:: ============================================================
::   [1] 启动本地版
:: ============================================================
:START_LOCAL
call :CHECK_PORTS
echo.
echo  [1/4] 启动后端 (FastAPI :8000)...
call :START_BACKEND
echo.
echo  [2/4] 等待后端就绪...
call :WAIT_PORT 8000 30
echo.
echo  [3/4] 启动前端 (Vite :5173)...
call :START_FRONTEND
echo.
echo  [4/4] 等待前端就绪...
call :WAIT_PORT 5173 20
echo.
goto SHOW_RESULT

:: ============================================================
::   [2] 启动前端 + 远程后端
:: ============================================================
:START_FRONT_REMOTE_BACKEND
echo.
echo  [1/3] 测试远程后端连通性...
curl -s --max-time 5 "%CLOUD_BACKEND%/health" >nul 2>&1
if %errorlevel% neq 0 (
    echo   [警告] 无法连接远程后端 %CLOUD_BACKEND%
    echo   请检查网络或云端服务状态
    set /p CONTINUE=  是否仍要启动前端？[Y/N]
    if /i not "!CONTINUE!"=="Y" goto MENU
) else (
    echo   远程后端可达: %CLOUD_BACKEND%
)
echo.
echo  [2/3] 启动前端 (Vite :5173)...
call :START_FRONTEND
echo.
echo  [3/3] 等待前端就绪...
call :WAIT_PORT 5173 20
echo.
echo  ============================================================
echo   平台已就绪（前端本地，后端远程）
echo   前端: %LOCAL_FRONTEND%
echo   后端: %CLOUD_BACKEND% (远程)
echo  ============================================================
echo.
set /p OPEN=  是否打开浏览器？[Y/N]
if /i "!OPEN!"=="Y" start "" "%LOCAL_FRONTEND%"
pause
goto MENU

:: ============================================================
::   [3] 仅启动前端
:: ============================================================
:START_FRONTEND_ONLY
echo.
echo  启动前端 (Mock 模式)...
call :START_FRONTEND
call :WAIT_PORT 5173 20
echo.
echo  ============================================================
echo   前端已就绪（Mock 模式）
echo   访问: %LOCAL_FRONTEND%
echo  ============================================================
echo.
set /p OPEN=  是否打开浏览器？[Y/N]
if /i "!OPEN!"=="Y" start "" "%LOCAL_FRONTEND%"
pause
goto MENU

:: ============================================================
::   [4] 仅启动后端
:: ============================================================
:START_BACKEND_ONLY
echo.
echo  启动后端 (FastAPI :8000)...
call :START_BACKEND
call :WAIT_PORT 8000 30
echo.
echo  ============================================================
echo   后端已就绪
echo   API: %LOCAL_BACKEND%/docs
echo  ============================================================
echo.
pause
goto MENU

:: ============================================================
::   [5] 停止所有本地服务
:: ============================================================
:STOP_ALL
echo.
echo  正在停止 8000 端口...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    echo   终止 PID=%%P
    taskkill /F /PID %%P >nul 2>&1
)
echo  正在停止 5173 端口...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo   终止 PID=%%P
    taskkill /F /PID %%P >nul 2>&1
)
echo  关闭 AICC 相关 cmd 窗口...
taskkill /F /FI "WINDOWTITLE eq AICC Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AICC Frontend*" >nul 2>&1
echo  完成。
echo.
pause
goto MENU

:: ============================================================
::   [6] 查看状态
:: ============================================================
:STATUS
echo.
echo  === 端口状态 ===
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (echo   [✓] 8000 端口正在监听) else (echo   [ ] 8000 端口未监听)
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (echo   [✓] 5173 端口正在监听) else (echo   [ ] 5173 端口未监听)

echo.
echo  === 后端健康检查 ===
curl -s --max-time 3 "%LOCAL_BACKEND%/health" 2>nul
if %errorlevel% neq 0 echo   本地后端无响应

echo.
echo  === 云端后端 ===
curl -s --max-time 3 "%CLOUD_BACKEND%/health" 2>nul
if %errorlevel% neq 0 echo   云端后端无响应

echo.
echo  === 进程列表（Python + Node）===
tasklist | findstr /I "python.exe node.exe" 2>nul
echo.
pause
goto MENU

:: ============================================================
::   [7] 打开云端
:: ============================================================
:OPEN_CLOUD
start "" "%CLOUD_FRONTEND%"
echo  已打开: %CLOUD_FRONTEND%
timeout /t 3 /nobreak >nul
goto MENU

:: ============================================================
::   启动完成
:: ============================================================
:SHOW_RESULT
echo  ============================================================
echo   平台已就绪
echo   前端: %LOCAL_FRONTEND%
echo   后端: %LOCAL_BACKEND%/docs
echo   登录: admin / admin123
echo  ============================================================
echo.
echo   关闭此窗口不会停止后端和前端
echo   如需停止，请使用菜单 [5] 停止本地服务
echo.
set /p OPEN=  是否打开浏览器？[Y/N]
if /i "!OPEN!"=="Y" start "" "%LOCAL_FRONTEND%"
echo.
echo  按任意键返回菜单...
pause >nul
goto MENU

:: ============================================================
::   工具函数
:: ============================================================

:CHECK_PORTS
echo.
echo  [0/4] 检查端口占用...
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [!] 8000 端口已被占用，将复用现有进程
) else (
    echo   [ ] 8000 端口空闲
)
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [!] 5173 端口已被占用，将复用现有进程
) else (
    echo   [ ] 5173 端口空闲
)
exit /b 0

:START_BACKEND
:: 若端口已占用则跳过
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [!] 8000 端口已有进程运行，跳过启动
    exit /b 0
)
if not exist "!PYTHON_EXE!" (
    echo   [X] 未找到 Python
    pause
    exit /b 1
)
cd /d "%BACKEND_DIR%"
:: 用 start /B + 重定向避免阻塞；窗口关闭不影响进程
start "AICC Backend" /B cmd /c "cd /d "%BACKEND_DIR%" && set PYTHONUNBUFFERED=1 && "!PYTHON_EXE!" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "%TEMP%\aicc_backend.log" 2>&1"
echo   后端已启动，日志: %TEMP%\aicc_backend.log
exit /b 0

:START_FRONTEND
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [!] 5173 端口已有进程运行，跳过启动
    exit /b 0
)
if not exist "!NODE_EXE!" (
    echo   [X] 未找到 Node.js
    pause
    exit /b 1
)
if not exist "%FRONTEND_DIR%\node_modules\vite\bin\vite.js" (
    echo   [!] 前端依赖未安装，正在安装...
    cd /d "%FRONTEND_DIR%"
    call npm install
    if errorlevel 1 (
        echo   [X] npm install 失败
        pause
        exit /b 1
    )
)
cd /d "%FRONTEND_DIR%"
start "AICC Frontend" /B cmd /c "cd /d "%FRONTEND_DIR%" && "!NODE_EXE!" node_modules/vite/bin/vite.js --host 0.0.0.0 > "%TEMP%\aicc_frontend.log" 2>&1"
echo   前端已启动，日志: %TEMP%\aicc_frontend.log
exit /b 0

:WAIT_PORT
:: 参数1: 端口号  参数2: 最大等待秒数
set "PORT=%~1"
set "MAX_SECONDS=%~2"
set /a WAIT_COUNT=0
:WAIT_LOOP
timeout /t 1 /nobreak >nul
set /a WAIT_COUNT+=1
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] 端口 %PORT% 已就绪 (!WAIT_COUNT!秒)
    exit /b 0
)
if !WAIT_COUNT! lss %MAX_SECONDS% (
    set /a MOD=WAIT_COUNT %% 5
    if !MOD! equ 0 echo   ... 等待端口 %PORT% 启动 (!WAIT_COUNT!/%MAX_SECONDS%秒)
    goto WAIT_LOOP
)
echo   [!] 端口 %PORT% 在 %MAX_SECONDS% 秒内未就绪
exit /b 1
