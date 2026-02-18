# 杏铃酱 · 永久记忆AI伴侣

<div align="center">
  <h3>一个会永远记住你的AI聊天伙伴</h3>
  <p>完全本地运行 · 永久记忆 · 高度可定制</p>
</div>

---

## ✨ 特性

- 🧠 **永久记忆**：对话自动保存，超过一定轮数自动生成摘要，实现无限记忆
- 🎨 **完全个性化**：双击修改名字、点击上传头像、更换聊天背景
- 💬 **流式对话**：逐字显示回复，带思考过程（可选）
- 🔍 **联网搜索**：支持 Tavily / Google Serper，可自由开关
- 📂 **多会话管理**：侧边栏切换、新建、重命名、删除会话
- 📦 **导入/导出**：一键备份所有会话和配置
- 🌙 **深色模式**：默认深色主题，护眼舒适
- 🔧 **可配置后端**：支持任何 OpenAI 兼容的 API（DeepSeek、OpenAI、Ollama 本地模型等）

## 🏗️ 技术架构

- **前端**：Next.js + TypeScript + Tailwind CSS
- **后端**：Python + FastAPI
- **记忆存储**：本地 JSON 文件 + 自动摘要
- **AI 模型**：兼容 OpenAI 接口（默认 DeepSeek）

## 🚀 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+ / npm

### 安装与运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/zhyuuka/xingling-chat.git
   cd xingling-chat
2.启动后端

bash
cd backend
pip install fastapi uvicorn openai requests
uvicorn main:app --reload --port 8000
3.启动前端

bash
cd ../frontend
npm install
npm run dev
4.访问
浏览器打开 http://localhost:3000，开始聊天！

一键启动（Windows）
双击项目根目录的 start_all.bat 即可自动启动前后端并打开浏览器。

⚙️ 配置说明
API 密钥
在界面右上角“设置”中填入你的 API Key（DeepSeek、OpenAI 等）

或者直接在 backend/memory_core.py 中修改 DEFAULT_API_KEY

联网搜索
在设置中启用搜索，选择服务商并填入对应 API Key

支持 Tavily 和 Google Serper

自定义
双击助手名字：修改昵称

点击头像：上传并裁剪图片

点击 🌄 按钮：上传聊天背景

侧边栏底部：清空会话、导出/导入数据

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

B站：https://b23.tv/LWF95IO · QQ反馈：3684939695
