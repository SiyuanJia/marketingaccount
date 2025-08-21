# 后端设置说明

## 概述

为了使用阿里云Paraformer ASR服务，需要将录音文件上传到公网可访问的存储服务。本文档提供了几种实现方案。

## 方案一：使用阿里云OSS（推荐）

### 1. 创建OSS存储桶

1. 登录阿里云控制台
2. 进入对象存储OSS服务
3. 创建新的存储桶（Bucket）
4. 设置访问权限为"公共读"或配置临时访问策略

### 2. 获取访问凭证

- AccessKey ID
- AccessKey Secret
- Bucket名称
- 地域端点

### 3. 后端API实现示例（Node.js）

```javascript
const express = require('express');
const multer = require('multer');
const OSS = require('ali-oss');
const app = express();

// OSS配置
const client = new OSS({
  region: 'oss-cn-hangzhou', // 你的地域
  accessKeyId: 'YOUR_ACCESS_KEY_ID',
  accessKeySecret: 'YOUR_ACCESS_KEY_SECRET',
  bucket: 'your-bucket-name'
});

// 配置multer用于文件上传
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB限制
});

// 音频上传接口
app.post('/api/upload/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const filename = `recordings/${timestamp}-${req.file.originalname}`;
    
    // 上传到OSS
    const result = await client.put(filename, req.file.buffer);
    
    // 返回公网可访问的URL
    res.json({
      url: result.url,
      filename: filename,
      size: req.file.size
    });
    
  } catch (error) {
    console.error('上传失败:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

app.listen(3000, () => {
  console.log('服务器运行在端口 3000');
});
```

### 4. Python Flask示例

```python
from flask import Flask, request, jsonify
import oss2
import uuid
from datetime import datetime

app = Flask(__name__)

# OSS配置
auth = oss2.Auth('YOUR_ACCESS_KEY_ID', 'YOUR_ACCESS_KEY_SECRET')
bucket = oss2.Bucket(auth, 'oss-cn-hangzhou.aliyuncs.com', 'your-bucket-name')

@app.route('/api/upload/audio', methods=['POST'])
def upload_audio():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
        
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
        
        # 生成唯一文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        filename = f"recordings/{timestamp}_{unique_id}_{file.filename}"
        
        # 上传到OSS
        result = bucket.put_object(filename, file.read())
        
        # 构建公网访问URL
        url = f"https://your-bucket-name.oss-cn-hangzhou.aliyuncs.com/{filename}"
        
        return jsonify({
            'url': url,
            'filename': filename,
            'size': len(file.read())
        })
        
    except Exception as e:
        print(f"上传失败: {e}")
        return jsonify({'error': '上传失败'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=3000)
```

## 方案二：使用其他云存储服务

### AWS S3
- 使用AWS SDK上传文件
- 配置公共读权限或预签名URL

### 腾讯云COS
- 使用腾讯云COS SDK
- 配置访问权限

### 七牛云
- 使用七牛云SDK
- 配置公开空间

## 方案三：自建文件服务器

### Nginx静态文件服务

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location /uploads/ {
        alias /var/www/uploads/;
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type";
    }
}
```

### 简单的Express静态服务器

```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();

// 配置静态文件服务
app.use('/uploads', express.static('uploads'));

// 配置文件上传
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({ storage });

app.post('/api/upload/audio', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }
  
  const url = `http://your-domain.com/uploads/${req.file.filename}`;
  res.json({ url });
});
```

## 安全注意事项

1. **访问控制**：确保上传的文件只能被授权用户访问
2. **文件类型验证**：验证上传的文件确实是音频文件
3. **大小限制**：设置合理的文件大小限制
4. **临时URL**：考虑使用临时访问URL而不是永久公开
5. **清理机制**：定期清理不再需要的文件

## 开发测试

在开发阶段，可以使用以下工具进行测试：

1. **ngrok**：将本地服务暴露到公网
   ```bash
   npm install -g ngrok
   ngrok http 3000
   ```

2. **localtunnel**：另一个内网穿透工具
   ```bash
   npm install -g localtunnel
   lt --port 3000
   ```

## 配置说明

在前端配置中，需要设置：

1. **上传端点**：`/api/upload/audio`
2. **DashScope API Key**：在设置中配置
3. **CORS设置**：确保后端允许前端域名的跨域请求

## 故障排查

1. **上传失败**：检查文件大小、格式、网络连接
2. **URL无法访问**：检查存储服务的访问权限设置
3. **ASR识别失败**：确认URL可以被阿里云服务访问
4. **CORS错误**：检查后端的跨域配置
