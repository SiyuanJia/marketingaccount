# 🛠️ 本地开发指南

## 📋 快速开始

### 1. 启动本地代理服务器

由于浏览器CORS限制，本地开发需要启动代理服务器：

```bash
# 方法一：直接运行
node dev-proxy.js

# 方法二：使用npm脚本
npm run dev

# 方法三：使用proxy命令
npm run proxy
```

### 2. 启动成功标志

看到以下输出说明启动成功：
```
🚀 本地开发代理服务器启动成功！
📡 监听端口: 3001
🌐 代理地址: http://localhost:3001
🔍 健康检查: http://localhost:3001/healthz

💡 使用说明:
  - 保持此终端窗口打开
  - 在浏览器中打开 http://localhost:8000
  - 配置API Key后即可使用语音识别功能

⏹️  停止服务器: Ctrl+C
```

### 3. 打开应用

保持代理服务器运行，然后：
- 打开浏览器
- 访问 `http://localhost:8000` 或直接打开 `index.html`
- 配置API Key
- 开始使用语音识别功能

## 🔧 文件说明

### 本地开发文件
- `dev-proxy.js` - 本地开发代理服务器
- `package.json` - 包含开发脚本

### 生产部署文件  
- `api/proxy.js` - Vercel serverless 函数
- `vercel.json` - Vercel 部署配置

## 🚀 部署到生产环境

当您准备部署到生产环境时：

1. **推送到GitHub**：
   ```bash
   git add .
   git commit -m "准备部署"
   git push origin main
   ```

2. **在Vercel中部署**：
   - 登录 vercel.com
   - 导入GitHub项目
   - 自动部署

3. **更新生产配置**：
   - 获取Vercel域名
   - 更新 `js/proxy-config.js` 和 `js/asr-service.js` 中的生产代理地址

## 🧪 测试代理服务器

### 健康检查
```bash
curl http://localhost:3001/healthz
```

应该返回：
```json
{
  "status": "ok",
  "message": "Development CORS proxy is running",
  "timestamp": "2024-08-21T14:30:00.000Z"
}
```

### 测试代理功能
代理服务器会在控制台显示详细的请求日志：
```
🔄 代理请求: POST https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription
📡 来源: http://localhost:8000
✅ 代理响应: 200 (1234 bytes)
```

## ⚠️ 注意事项

1. **保持代理服务器运行**：在使用应用期间，必须保持 `dev-proxy.js` 运行
2. **端口冲突**：如果3001端口被占用，修改 `dev-proxy.js` 中的 `PORT` 变量
3. **安全限制**：代理服务器只允许访问特定的API域名（DashScope、302.ai、飞书）
4. **开发环境专用**：`dev-proxy.js` 仅用于本地开发，生产环境使用 `api/proxy.js`

## 🔍 故障排查

### 代理服务器启动失败
```bash
# 检查端口是否被占用
netstat -an | grep 3001

# 或者使用其他端口
PORT=3002 node dev-proxy.js
```

### CORS错误仍然存在
1. 确认代理服务器正在运行
2. 检查浏览器控制台的详细错误信息
3. 确认API Key配置正确
4. 尝试重启代理服务器

### 无法访问应用
1. 确认使用 `http://localhost:8000` 而不是 `file://` 协议
2. 如果使用Live Server，确认端口号正确
3. 检查防火墙设置
