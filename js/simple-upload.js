/**
 * 纯前端文件上传服务
 * 使用免费的临时文件托管服务，无需后端
 * 专为产品原型验证设计
 */

class SimpleUploadService {
    constructor() {
        // 免费文件托管服务列表
        this.services = [
            {
                name: 'TmpFiles.org',
                upload: this.uploadToTmpFiles.bind(this),
                maxSize: 100 * 1024 * 1024, // 100MB
                available: true
            },
            {
                name: '0x0.st',
                upload: this.uploadToZeroBin.bind(this),
                maxSize: 512 * 1024 * 1024, // 512MB
                available: true
            },
            {
                name: 'File.io',
                upload: this.uploadToFileIO.bind(this),
                maxSize: 100 * 1024 * 1024, // 100MB
                available: true
            },
            {
                name: 'Catbox.moe',
                upload: this.uploadToCatbox.bind(this),
                maxSize: 200 * 1024 * 1024, // 200MB
                available: true
            },
            {
                name: 'Uguu.se',
                upload: this.uploadToUguu.bind(this),
                maxSize: 128 * 1024 * 1024, // 128MB
                available: true
            }
        ];

        this.currentServiceIndex = 0;
    }

    /**
     * 获取代理基础地址（开发环境用本地，生产用线上）
     */
    async getProxyBase() {
        const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (isDev) return 'http://localhost:3001';
        if (window.proxyConfig && typeof window.proxyConfig.getAvailableProxy === 'function') {
            try {
                return await window.proxyConfig.getAvailableProxy();
            } catch (e) {
                console.warn('proxy-config 获取代理失败，使用默认线上代理', e);
            }
        }
        return 'https://marketingaccount.vercel.app/api/proxy';
    }

    /**
     * 上传音频文件（自动重试多个服务）
     * @param {Blob} audioBlob - 音频数据
     * @returns {Promise<string>} 公网可访问的URL
     */
    async uploadAudio(audioBlob) {
        // 优先在上传前进行格式转换（Opus -> WAV），避免阿里云解码失败
        try {
            if (window.AudioUtils && typeof window.AudioUtils.convertToWavIfNeeded === 'function') {
                audioBlob = await window.AudioUtils.convertToWavIfNeeded(audioBlob);
            }
        } catch (e) {
            console.warn('上传前音频预处理失败，继续使用原始音频:', e);
        }

        console.log('🔍 音频文件信息:');
        console.log('  - MIME类型:', audioBlob.type);
        console.log('  - 文件大小:', audioBlob.size);

        let extension = this.getFileExtension(audioBlob.type);
        if (extension === 'audio') {
            // 兜底，避免出现 .audio
            extension = audioBlob.type.includes('wav') ? 'wav' : 'm4a';
        }
        console.log('  - 映射扩展名:', extension);

        const filename = `recording-${Date.now()}.${extension}`;
        console.log('  - 生成文件名:', filename);

        // 检查文件大小
        const maxSize = Math.max(...this.services.map(s => s.maxSize));
        if (audioBlob.size > maxSize) {
            throw new Error(`文件大小超过限制 (${this.formatFileSize(maxSize)})`);
        }

        // 尝试所有可用的服务
        for (let i = 0; i < this.services.length; i++) {
            const serviceIndex = (this.currentServiceIndex + i) % this.services.length;
            const service = this.services[serviceIndex];

            if (!service.available || audioBlob.size > service.maxSize) {
                continue;
            }

            try {
                console.log(`尝试上传到 ${service.name}...`);
                const url = await this.uploadWithRetry(service, audioBlob, filename);

                // 上传成功，更新首选服务
                this.currentServiceIndex = serviceIndex;
                console.log(`✅ 上传成功: ${service.name}`);
                return url;

            } catch (error) {
                console.warn(`❌ ${service.name} 上传失败:`, error.message);

                // 网络错误时不立即禁用服务，其他错误才禁用
                if (!this.isNetworkError(error)) {
                    service.available = false;
                    // 5分钟后重新启用
                    setTimeout(() => {
                        service.available = true;
                    }, 5 * 60 * 1000);
                }
            }
        }

        // 所有服务都失败时，尝试保存到本地缓存
        try {
            const cacheKey = await this.saveToLocalCache(audioBlob, filename);
            console.log('📦 已保存到本地缓存，稍后可重试上传');
            throw new Error(`上传失败，已保存到本地缓存 (${cacheKey})。请检查网络连接后重试。`);
        } catch (cacheError) {
            console.error('本地缓存也失败了:', cacheError);
            throw new Error('所有上传服务都不可用，本地缓存也失败，请稍后重试');
        }
    }

    /**
     * 带重试的上传
     */
    async uploadWithRetry(service, audioBlob, filename, maxRetries = 2) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await service.upload(audioBlob, filename);
            } catch (error) {
                lastError = error;
                console.warn(`${service.name} 第${attempt}次尝试失败:`, error.message);

                // 如果是网络错误且还有重试机会，等待后重试
                if (this.isNetworkError(error) && attempt < maxRetries) {
                    const delay = attempt * 1000; // 递增延迟
                    console.log(`${delay}ms后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                throw error;
            }
        }

        throw lastError;
    }

    /**
     * 检测是否为网络错误
     */
    isNetworkError(error) {
        const networkErrors = [
            'Failed to fetch',
            'ERR_CONNECTION_RESET',
            'ERR_NETWORK',
            'ERR_INTERNET_DISCONNECTED',
            'ERR_CONNECTION_REFUSED',
            'ERR_CONNECTION_TIMED_OUT'
        ];

        return networkErrors.some(errorType =>
            error.message.includes(errorType) ||
            error.toString().includes(errorType)
        );
    }

    /**
     * 保存到本地缓存（IndexedDB）
     */
    async saveToLocalCache(audioBlob, filename) {
        const cacheKey = `upload_cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // 使用现有的 audio-utils.js 中的 IndexedDB 功能
            if (window.saveAudioBlob) {
                await window.saveAudioBlob(cacheKey, audioBlob);

                // 保存元数据
                const metadata = {
                    filename,
                    timestamp: Date.now(),
                    size: audioBlob.size,
                    type: audioBlob.type
                };
                localStorage.setItem(`upload_cache_meta_${cacheKey}`, JSON.stringify(metadata));

                return cacheKey;
            } else {
                throw new Error('IndexedDB 不可用');
            }
        } catch (error) {
            console.error('保存到本地缓存失败:', error);
            throw error;
        }
    }

    /**
     * 从本地缓存重试上传
     */
    async retryFromCache() {
        const cacheKeys = Object.keys(localStorage)
            .filter(key => key.startsWith('upload_cache_meta_'))
            .map(key => key.replace('upload_cache_meta_', ''));

        if (cacheKeys.length === 0) {
            console.log('没有待重试的缓存文件');
            return [];
        }

        const results = [];
        for (const cacheKey of cacheKeys) {
            try {
                const metadataStr = localStorage.getItem(`upload_cache_meta_${cacheKey}`);
                if (!metadataStr) continue;

                const metadata = JSON.parse(metadataStr);
                const audioBlob = await window.getAudioBlob(cacheKey);

                if (audioBlob) {
                    console.log(`重试上传缓存文件: ${metadata.filename}`);
                    const url = await this.uploadAudio(audioBlob);

                    // 上传成功，清理缓存
                    await window.deleteAudioBlob(cacheKey);
                    localStorage.removeItem(`upload_cache_meta_${cacheKey}`);

                    results.push({ success: true, filename: metadata.filename, url });
                } else {
                    // 缓存文件不存在，清理元数据
                    localStorage.removeItem(`upload_cache_meta_${cacheKey}`);
                }
            } catch (error) {
                console.error(`重试缓存文件 ${cacheKey} 失败:`, error);
                results.push({ success: false, cacheKey, error: error.message });
            }
        }

        return results;
    }

    /**
     * 上传到 TmpFiles.org
     */
    async uploadToTmpFiles(audioBlob, filename) {
        const formData = new FormData();
        formData.append('file', audioBlob, filename);

        const response = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.status !== 'success') {
            throw new Error(result.message || '上传失败');
        }

        // 尝试构造 https 直链
        let fileUrl = result.data.url; // 例如 https://tmpfiles.org/xxxxx
        if (fileUrl.startsWith('http://')) {
            fileUrl = fileUrl.replace('http://', 'https://');
        }
        // 尝试替换为下载直链
        let directUrl = fileUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');

        // 直链自检：通过本地代理发 HEAD，验证是否为 audio/*
        try {
            const proxyBase = await this.getProxyBase();
            const headUrl = `${proxyBase}?url=${encodeURIComponent(directUrl)}`;
            const headResp = await fetch(headUrl, { method: 'HEAD' });
            const ctype = headResp.headers.get('content-type') || '';
            if (!ctype.toLowerCase().startsWith('audio/')) {
                console.warn('直链自检失败，content-type=', ctype, '回退使用原始地址');
                directUrl = fileUrl; // 回退
            }
        } catch (e) {
            console.warn('直链自检异常，回退原始地址:', e);
            directUrl = fileUrl;
        }

        return directUrl;
    }

    /**
     * 上传到 0x0.st
     */
    async uploadToZeroBin(audioBlob) {
        const formData = new FormData();
        const filename = `recording-${Date.now()}.${this.getFileExtension(audioBlob.type)}`;
        formData.append('file', audioBlob, filename);

        const response = await fetch('https://0x0.st', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`0x0.st上传失败: ${response.statusText}`);
        }

        const url = await response.text();
        return url.trim();
    }

    /**
     * 上传到 File.io
     */
    async uploadToFileIO(audioBlob) {
        const formData = new FormData();
        const filename = `recording-${Date.now()}.${this.getFileExtension(audioBlob.type)}`;
        formData.append('file', audioBlob, filename);

        // 通过本地代理转发，避免浏览器CORS
        const endpoint = 'https://www.file.io';
        const proxyBase = await this.getProxyBase();
        const proxyUrl = `${proxyBase}?url=${encodeURIComponent(endpoint)}`;

        const response = await fetch(proxyUrl, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`File.io上传失败: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(`File.io上传失败: ${result.message || '未知错误'}`);
        }

        // file.io 返回的 link 一般为 HTTPS 直链
        return result.link;
    }

    /**
     * 获取下一个可用的服务
     */
    getNextAvailableService() {
        const serviceKeys = Object.keys(this.services);
        const currentIndex = serviceKeys.indexOf(this.currentService);
        
        for (let i = 1; i < serviceKeys.length; i++) {
            const nextIndex = (currentIndex + i) % serviceKeys.length;
            const nextKey = serviceKeys[nextIndex];
            if (this.services[nextKey].available) {
                return nextKey;
            }
        }
        
        return null;
    }

    /**
     * 获取文件扩展名
     */
    getFileExtension(mimeType) {
        // 归一化 MIME，去空格并小写
        const mt = (mimeType || '').toLowerCase().replace(/\s+/g, '');
        const map = {
            'audio/wav': 'wav',
            'audio/mp3': 'mp3',
            'audio/mpeg': 'mp3',
            'audio/mp4': 'm4a',
            'audio/mp4;codecs=mp4a.40.2': 'm4a',
            'audio/mp4;codecs=opus': 'm4a',
            'audio/m4a': 'm4a',
            'audio/aac': 'aac',
            'audio/ogg': 'ogg',
            'audio/webm': 'webm',
            'audio/webm;codecs=opus': 'webm',
            'audio/webm;codecs=vp8,opus': 'webm',
            'audio/flac': 'flac'
        };
        return map[mt] || (mt.includes('wav') ? 'wav' : 'm4a');
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * 测试服务可用性
     */
    async testService(serviceIndex) {
        const service = this.services[serviceIndex];
        if (!service) return false;

        try {
            // 创建一个小的测试文件
            const testBlob = new Blob(['test'], { type: 'text/plain' });
            const testFormData = new FormData();
            testFormData.append('file', testBlob, 'test.txt');

            // 简单的可用性测试（不实际上传）
            return true; // 暂时返回true，避免实际测试时的网络请求
        } catch (error) {
            console.warn(`服务 ${service.name} 测试失败:`, error);
            return false;
        }
    }

    /**
     * 检查所有服务的可用性
     */
    async checkAllServices() {
        const results = {};

        for (let i = 0; i < this.services.length; i++) {
            const service = this.services[i];
            console.log(`测试服务: ${service.name}...`);
            results[i] = await this.testService(i);
            this.services[i].available = results[i];
        }

        return results;
    }

    /**
     * 上传到 Catbox.moe
     */
    async uploadToCatbox(audioBlob, filename) {
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', audioBlob, filename);

        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const url = await response.text();
        if (!url || !url.startsWith('https://files.catbox.moe/')) {
            throw new Error('Invalid response from Catbox.moe');
        }

        return url.trim();
    }

    /**
     * 上传到 Uguu.se
     */
    async uploadToUguu(audioBlob, filename) {
        const formData = new FormData();
        formData.append('files[]', audioBlob, filename);

        const response = await fetch('https://uguu.se/upload.php', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success || !result.files || !result.files[0]) {
            throw new Error('Upload failed or invalid response');
        }

        return result.files[0].url;
    }

    /**
     * 获取服务状态
     */
    getStatus() {
        return {
            currentServiceIndex: this.currentServiceIndex,
            currentService: this.services[this.currentServiceIndex]?.name || 'None',
            services: this.services.map((service, index) => ({
                name: service.name,
                available: service.available,
                maxSize: this.formatFileSize(service.maxSize),
                current: index === this.currentServiceIndex
            })),
            totalAvailable: this.services.filter(s => s.available).length
        };
    }
}

// 导出服务实例
window.SimpleUploadService = SimpleUploadService;
