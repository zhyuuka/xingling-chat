# 杏铃酱 · 永久记忆AI伴侣
**⚠️ 版权与使用声明：本项目原创版权归作者所有，采用MIT协议开源。个人非商用可自由使用、修改、分发，使用时必须保留原作者署名与本仓库链接；任何商用、企业级使用、二次打包分发行为，需提前联系作者及法定监护人获得书面授权，违者将追究相关法律责任。**
杏铃酱 · 永久记忆AI伴侣
<div align="center"> <h3>一个会永远记住你的AI聊天伙伴</h3> <p>完全本地运行 · 永久记忆 · 高度可定制</p> <p> <a href="https://github.com/zhyuuka/xingling-chat/blob/main/LICENSE"> <img src="https://img.shields.io/github/license/zhyuuka/xingling-chat" alt="License" /> </a> <img src="https://img.shields.io/badge/Python-3.10+-blue" alt="Python" /> <img src="https://img.shields.io/badge/Node.js-18+-green" alt="Node.js" /> </p> </div>
<img width="1920" height="1080" alt="屏幕截图 2026-02-18 203856" src="https://github.com/user-attachments/assets/574196d7-cfe9-488a-b429-8698d97e1632" 
✨ 特性
🧠 永久记忆：对话自动保存，超过一定轮数自动生成摘要，实现无限记忆

🎨 完全个性化：双击修改名字、点击上传头像、更换聊天背景

💬 流式对话：逐字显示回复（如果发现无法显示，说明正在修理），带思考过程（可选）

🔍 联网搜索：支持 Tavily / Google Serper，可自由开关

📂 多会话管理：侧边栏切换、新建、重命名、删除会话

⚙️ 会话专属提示词：每个对话可设置独立的系统提示词（角色定制）

📎 文件上传分析：支持 .txt、.pdf、.docx，AI 自动分析内容

📦 导入/导出：一键备份所有会话和配置

🌙 深色模式：默认深色主题，护眼舒适

🔧 可配置后端：支持任何 OpenAI 兼容的 API（DeepSeek、OpenAI、Ollama 本地模型等）

🏗️ 技术架构
前端：Next.js + TypeScript + Tailwind CSS

后端：Python + FastAPI

记忆存储：本地 JSON 文件 + 自动摘要

AI 模型：兼容 OpenAI 接口（默认 DeepSeek）

🚀 快速开始
环境要求
Python 3.10 或更高版本

Node.js 18+ 及 npm

安装与运行
1. 克隆仓库
bash
git clone https://github.com/zhyuuka/xingling-chat.git
cd xingling-chat
2. 启动后端
bash
cd backend
# 建议创建虚拟环境
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install fastapi uvicorn openai requests PyPDF2 python-docx

# 启动服务
uvicorn main:app --reload --port 8000
后端服务将运行在 http://localhost:8000。

3. 启动前端
bash
cd ../frontend
npm install
npm run dev
前端开发服务器将运行在 http://localhost:3000，浏览器会自动打开。

一键启动（Windows）
在项目根目录双击 start_all.bat 即可自动启动前后端并打开浏览器。

⚙️ 配置说明
API 密钥
在界面右上角 “设置” 中填入你的 API Key（支持 DeepSeek、OpenAI 等）

或者直接在 backend/memory_core.py 中修改 DEFAULT_API_KEY

联网搜索
在设置中启用搜索，选择服务商（Tavily / Google Serper）并填入对应 API Key

点击聊天界面右上角的 🌐 图标可快速开关搜索

个性化
双击助手名字：修改昵称

点击头像：上传并裁剪图片

点击 🌄 按钮：上传聊天背景

侧边栏底部：清空会话、导出/导入数据

侧边栏每个会话右侧的 💬 图标：编辑该会话的专属系统提示词

📦 打包成可执行文件（exe）
如果你想给没有 Python/Node.js 环境的朋友使用，可以将项目打包为独立 exe。

后端打包
bash
cd backend
pip install pyinstaller
pyinstaller -F --noconsole main.py --name "杏铃酱后端"
生成的 exe 位于 backend/dist/杏铃酱后端.exe。

前端打包
修改 frontend/next.config.ts，添加 output: 'export'（如已有则忽略）。

构建静态文件：

bash
cd frontend
npm run build
生成 out 文件夹。

打包前端服务器：

bash
cd frontend
pip install pyinstaller
pyinstaller -F --noconsole serve_frontend.py --name "杏铃酱前端"
将生成的 dist/杏铃酱前端.exe 和 out 文件夹放在同一目录。

一键启动包制作
将 杏铃酱后端.exe、杏铃酱前端.exe、out 文件夹放入同一目录，并创建 一键启动.bat：

batch
@echo off
start "" "杏铃酱后端.exe"
timeout /t 3 /nobreak >nul
start "" "杏铃酱前端.exe"
timeout /t 2 /nobreak >nul
start http://localhost:3000
exit
打包整个文件夹为 zip，即可分享给朋友。

📁 数据存储
所有数据都在你的电脑上，无需联网：

对话历史：backend/memory_sessions/history_会话ID.json

长期摘要：backend/memory_sessions/summary_会话ID.txt

用户配置：浏览器 localStorage

🤝 贡献
欢迎提 Issue 和 Pull Request！如果你想增加新功能或改进现有代码，请先开 Issue 讨论。

📜 许可证
MIT

❤️ 致谢
项目由 zhyuuka 和 DeepSeek 共同完成

B站：https://b23.tv/LWF95IO

QQ反馈及教程需求：3684939695

杏铃酱——不会忘记你的朋友。
