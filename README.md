# AI Agency

## 系统要求

- Node.js 18+
- npm 9+
- SQLite3 (内置)

## 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 生产部署

```bash
# 构建
npm run build

# 启动
npm start
```

## Docker 部署

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f
```

## 环境变量

复制 `.env.example` 为 `.env` 并配置：

- `PORT` - 服务端口 (默认 3000)
- `DB_PATH` - 数据库路径
- `ENCRYPTION_KEY` - 加密密钥
- `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` 等 - LLM API 密钥

详细部署指南请参阅 [DEPLOYMENT.md](./DEPLOYMENT.md)
