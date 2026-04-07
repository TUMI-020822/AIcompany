# AI Agency - 智能公司管理平台

<div align="center">

**多智能体协作办公系统**

让 AI 代理成为你的虚拟员工，协同完成复杂任务

</div>

---

## 🚀 快速开始

### Windows 用户（一键启动）

双击运行以下脚本：

| 脚本 | 说明 |
|------|------|
| **`start.bat`** | 🟢 一键启动（生产模式） |
| **`dev-mode.bat`** | 🔵 开发模式（热重载） |
| **`stop.bat`** | 🔴 停止服务 |
| **`rebuild.bat`** | 🔨 重新构建 |

首次运行会自动：
1. 检查 Node.js 环境
2. 创建 `.env` 配置文件
3. 安装依赖
4. 构建项目
5. 启动服务

### 手动启动

```bash
# 安装依赖
npm install

# 构建（首次需要）
npm run build

# 启动
npm start
```

### 开发模式

```bash
npm run dev
```

开发模式会同时启动：
- 后端服务 (http://localhost:3000) - 热重载
- 前端开发服务器 (http://localhost:5173) - Vite HMR

---

## ⚙️ 配置

首次运行会自动创建 `.env` 文件，请至少配置一个 LLM API Key：

```env
# 推荐使用 DeepSeek（国内可直接访问）
DEEPSEEK_API_KEY=sk-xxx

# 或者使用其他提供商
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-xxx
GOOGLE_AI_API_KEY=xxx
```

---

## 📦 系统要求

- **Node.js** 18+ 
- **npm** 9+
- **SQLite3**（内置，无需额外安装）

---

## 🐳 Docker 部署

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

---

## 📖 功能特点

- 🏢 **公司管理** - 创建多个虚拟公司
- 👥 **代理雇佣** - 从人才库雇佣 AI 代理
- 💬 **智能对话** - 与代理实时交流
- 📋 **任务编排** - 复杂任务自动分解执行
- 🔧 **MCP 集成** - 扩展代理能力
- 🎯 **技能系统** - 专业领域知识注入

---

## 📁 项目结构

```
AIcompany/
├── packages/
│   ├── server/          # 后端服务 (Express + Socket.IO)
│   └── web/             # 前端应用 (React + Vite)
├── start.bat            # 一键启动
├── dev-mode.bat         # 开发模式
├── stop.bat             # 停止服务
├── rebuild.bat          # 重新构建
└── docker-compose.yml   # Docker 配置
```

---

## 📚 文档

- [部署指南](./DEPLOYMENT.md)
- [API 文档](./docs/api.md)

---

## 📄 License

MIT
