# AI Agency - 部署指南

## 🚀 快速开始

### 开发环境

**Windows:**
```bash
# 方式1: 使用启动脚本
dev.bat

# 方式2: 手动启动
npm install
npm run dev
```

**Linux/macOS:**
```bash
chmod +x dev.sh
./dev.sh
```

### 生产环境

**Windows:**
```bash
setup.bat
npm start
```

**Linux/macOS:**
```bash
chmod +x setup.sh
./setup.sh
npm start
```

---

## 🐳 Docker 部署

### 构建并启动

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

### 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# 服务端口
PORT=3000
NODE_ENV=production

# 数据库
DB_PATH=./data/ai-agency.db
ENCRYPTION_KEY=your-random-32-char-encryption-key

# LLM API Keys (至少配置一个)
DEEPSEEK_API_KEY=sk-xxx
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-xxx
GOOGLE_AI_API_KEY=xxx

# Ollama (本地)
OLLAMA_BASE_URL=http://host.docker.internal:11434

# MCP (可选)
GITHUB_TOKEN=xxx
BRAVE_SEARCH_API_KEY=xxx
```

### Docker 常用命令

```bash
# 进入容器
docker-compose exec app sh

# 查看资源使用
docker stats ai-agency-app

# 重启服务
docker-compose restart

# 清理并重建
docker-compose down -v
docker-compose up -d --build
```

---

## 📊 监控和健康检查

### 健康检查端点

```bash
# 基础健康检查
curl http://localhost:3000/api/health

# 详细性能报告
curl http://localhost:3000/api/system/performance

# 实时资源使用
curl http://localhost:3000/api/system/resources

# 错误日志统计
curl http://localhost:3000/api/system/errors

# 数据库健康检查
curl http://localhost:3000/api/system/health
```

### 性能监控指标

系统自动收集以下指标：

- **请求响应时间**: P50/P95/P99 延迟
- **资源使用**: 内存、CPU、数据库大小
- **任务指标**: 完成数、失败数、Token消耗
- **错误追踪**: 按类型分类的错误统计

---

## 💾 数据库管理

### 自动备份

系统每天自动备份数据库，保留最近 7 个备份：

- 备份位置: `data/backups/`
- 自动清理旧备份

### 手动备份

```bash
# 通过 API 触发备份
curl -X POST http://localhost:3000/api/system/backup

# 列出所有备份
curl http://localhost:3000/api/system/backups

# 恢复备份
curl -X POST http://localhost:3000/api/system/restore/backup-filename.db
```

### 数据库维护

```bash
# 检查数据库完整性
sqlite3 data/ai-agency.db "PRAGMA integrity_check;"

# 优化数据库
sqlite3 data/ai-agency.db "VACUUM;"

# 查看数据库统计
sqlite3 data/ai-agency.db "SELECT name FROM sqlite_master WHERE type='table';"
```

---

## 🔒 安全建议

### 生产环境必做

1. **更改加密密钥**
   ```env
   ENCRYPTION_KEY=your-secure-random-32-character-key
   ```

2. **限制 CORS**
   ```typescript
   // 在 config.ts 中配置允许的域名
   ALLOWED_ORIGINS=https://your-domain.com
   ```

3. **启用 HTTPS**
   - 使用 Nginx/Caddy 反向代理
   - 配置 SSL 证书

4. **环境变量隔离**
   - 不要提交 `.env` 文件
   - 使用 Docker secrets 或云服务密钥管理

5. **API Key 保护**
   - 在应用内按公司配置 API Key
   - 不要在代码中硬编码

### 网络安全

```bash
# 使用防火墙限制访问
ufw allow 3000/tcp
ufw enable

# 或使用 Nginx 反向代理
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## ⚡ 性能优化

### 启用垃圾回收监控

```bash
# 启动时添加参数
node --expose-gc packages/server/dist/index.js

# 通过 API 手动触发 GC
curl -X POST http://localhost:3000/api/system/gc
```

### 内存优化

- 定期检查内存使用: `/api/system/resources`
- 监控任务积压: `/api/system/performance`
- 清理旧数据: 定期删除过期任务和消息

### 数据库优化

- SQLite WAL 模式已启用
- 定期执行 VACUUM
- 监控数据库文件大小

---

## 🐛 故障排查

### 常见问题

**1. 端口被占用**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Linux/macOS
lsof -i :3000
kill -9 <pid>
```

**2. 数据库锁定**
```bash
# 检查是否有其他进程
lsof data/ai-agency.db

# 重启服务
docker-compose restart
```

**3. API Key 无效**
```bash
# 检查健康状态
curl http://localhost:3000/api/health

# 查看错误日志
curl http://localhost:3000/api/system/errors
```

**4. 内存不足**
```bash
# 查看内存使用
curl http://localhost:3000/api/system/resources

# 增加容器内存限制
# 在 docker-compose.yml 中添加:
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
```

### 日志查看

```bash
# Docker 日志
docker-compose logs -f app

# 错误日志文件
cat logs/errors.log

# 系统日志
docker-compose exec app cat /app/logs/errors.log
```

---

## 📦 升级指南

### 从旧版本升级

1. **备份数据**
   ```bash
   cp -r data data-backup
   ```

2. **拉取最新代码**
   ```bash
   git pull origin main
   ```

3. **重新安装依赖**
   ```bash
   npm install
   ```

4. **重新构建**
   ```bash
   npm run build
   ```

5. **重启服务**
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

---

## 📞 支持

- GitHub Issues: https://github.com/TUMI-020822/AIcompany/issues
- 文档: https://github.com/TUMI-020822/AIcompany/wiki
