# 🚀 Vercel 部署指南

## 🎯 解决 "Function Runtimes must have a valid version" 错误

您遇到的错误是因为原来的 `proxy.js` 文件是传统的 Node.js HTTP 服务器格式，而 Vercel 需要的是 serverless 函数格式。

## ✅ 已修复的问题

### 1. **创建了正确的 Vercel 函数**
- 新建了 `api/proxy.js` 文件，使用 Vercel serverless 函数格式
- 删除了旧的 `proxy.js` 文件

### 2. **更新了 vercel.json 配置**
```json
{
  "version": 2,
  "functions": {
    "api/proxy.js": {
      "runtime": "nodejs18.x"
    }
  },
  "routes": [
    {
      "src": "/api/proxy",
      "dest": "/api/proxy.js"
    }
  ]
}
```

### 3. **添加了 package.json**
- Vercel 需要 `package.json` 来识别 Node.js 项目
- 指定了 Node.js 版本要求

## 🚀 部署步骤

### 1. 推送更新到 GitHub
```bash
git add .
git commit -m "修复Vercel部署配置"
git push origin main
```

### 2. 在 Vercel 中重新部署
- 登录 [vercel.com](https://vercel.com)
- 找到您的项目
- 点击 "Redeploy" 或等待自动部署

### 3. 验证部署
部署成功后，访问以下URL测试：
```
https://your-project.vercel.app/api/proxy
```

应该返回：
```json
{
  "status": "ok",
  "message": "CORS proxy is running"
}
```

## 🔧 部署后配置

### 1. 获取您的 Vercel 域名
部署完成后，Vercel 会提供一个域名，例如：
- `https://ai-voice-ledger.vercel.app`
- `https://your-project-name.vercel.app`

### 2. 更新代理配置
将以下文件中的 `your-project.vercel.app` 替换为您的实际域名：

**js/proxy-config.js**:
```javascript
{
    url: 'https://your-actual-domain.vercel.app/api/proxy',
    name: 'Vercel代理',
    priority: 2,
    prodOnly: true
}
```

**js/asr-service.js**:
```javascript
return 'https://your-actual-domain.vercel.app/api/proxy';
```

### 3. 重新提交更新
```bash
git add .
git commit -m "更新生产环境代理地址"
git push origin main
```

## 🧪 测试部署

### 1. 访问您的应用
```
https://your-project.vercel.app
```

### 2. 测试代理功能
```
https://your-project.vercel.app/api/proxy
```

### 3. 测试完整功能
1. 配置 DashScope API Key
2. 录制语音测试
3. 查看控制台输出

## 🔍 故障排查

### 如果仍然有部署错误：

1. **检查 vercel.json 格式**
   - 确保 JSON 格式正确
   - 确保路径匹配

2. **检查函数文件**
   - 确保 `api/proxy.js` 存在
   - 确保使用 ES6 export 语法

3. **查看 Vercel 部署日志**
   - 在 Vercel 控制台查看详细错误信息

4. **清除缓存重新部署**
   - 在 Vercel 项目设置中清除构建缓存

## 📞 如果还有问题

如果部署仍然失败，请提供：
1. Vercel 的完整错误信息
2. 您的项目 GitHub 地址
3. Vercel 项目设置截图

这样我可以提供更具体的解决方案。
