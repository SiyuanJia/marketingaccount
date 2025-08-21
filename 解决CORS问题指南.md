# 解决CORS跨域问题指南

## 🎯 问题说明

由于浏览器的同源策略，前端无法直接调用阿里云API，会出现CORS错误：
```
Access to fetch at 'https://dashscope.aliyuncs.com/...' has been blocked by CORS policy
```

## 🚀 解决方案（3选1）

### 方案一：使用本地代理服务器（推荐）

#### 1. 安装Node.js
- 访问 [nodejs.org](https://nodejs.org/) 下载并安装

#### 2. 启动代理服务器
```bash
# 在项目目录下运行
node proxy-server.js
```

看到以下输出说明启动成功：
```
🚀 CORS代理服务器启动成功！
📡 监听端口: 3001
🌐 代理地址: http://localhost:3001
```

#### 3. 测试录音功能
- 保持代理服务器运行
- 刷新网页并测试录音

---

### 方案二：使用浏览器扩展

#### Chrome用户：
1. 安装 "CORS Unblock" 扩展
2. 启用扩展
3. 刷新页面测试

#### Firefox用户：
1. 安装 "CORS Everywhere" 扩展
2. 启用扩展
3. 刷新页面测试

---

### 方案三：临时禁用浏览器安全策略

#### Chrome：
```bash
# Windows
chrome.exe --user-data-dir="C:/Chrome dev session" --disable-web-security

# Mac
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security

# Linux
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev_test"
```

⚠️ **注意**：这种方法会降低浏览器安全性，仅用于开发测试！

---

## 🧪 测试步骤

### 1. 检查代理服务器
```bash
# 测试代理是否工作
curl http://localhost:3001
```

### 2. 录音测试
1. 确保已配置DashScope API Key
2. 点击录音按钮
3. 录制一段语音
4. 查看控制台输出

### 3. 成功标志
控制台应该显示：
```
✅ 上传成功: TmpFiles.org
🎤 开始语音识别...
✅ 任务已提交，任务ID: xxx
✅ 任务状态: SUCCEEDED
```

---

## 🔧 故障排查

### 代理服务器无法启动
```bash
# 检查端口是否被占用
netstat -an | grep 3001

# 或者修改端口
# 编辑 proxy-server.js，将 PORT = 3001 改为其他端口
```

### 仍然有CORS错误
1. 确认代理服务器正在运行
2. 检查控制台是否有其他错误
3. 尝试重启代理服务器

### API调用失败
1. 检查DashScope API Key是否正确
2. 确认账户有足够余额
3. 查看阿里云控制台的API调用日志

---

## 💡 生产环境建议

对于正式产品，推荐：

1. **后端代理**：在自己的服务器上创建API代理
2. **Serverless函数**：使用Vercel、Netlify等平台的函数
3. **云函数**：使用阿里云、腾讯云的云函数

---

## 📞 需要帮助？

如果遇到问题：

1. 查看浏览器控制台的完整错误信息
2. 确认代理服务器的输出日志
3. 检查网络连接和防火墙设置

现在选择一个方案开始测试吧！推荐使用**方案一**（本地代理服务器）。
