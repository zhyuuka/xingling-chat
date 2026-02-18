@echo off
echo 正在启动杏铃酱后端...
start cmd /k "cd /d C:\Users\ASUS\xingling-chat\backend && uvicorn main:app --port 8000"

echo 等待后端启动（3秒）...
timeout /t 3 /nobreak >nul

echo 正在启动杏铃酱前端...
start cmd /k "cd /d C:\Users\ASUS\xingling-chat\backend\frontend && npm run dev"

echo 等待前端启动（5秒）...
timeout /t 5 /nobreak >nul

echo 正在打开浏览器...
start http://localhost:3000

echo 完成！如果浏览器没有自动打开，请手动访问 http://localhost:3000