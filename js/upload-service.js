/**
 * 文件上传服务
 * 将录音文件上传到公网可访问的存储服务
 */

class UploadService {
    constructor() {
        // 支持的音频格式
        this.supportedFormats = [
            'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/aac', 
            'audio/ogg', 'audio/webm', 'audio/flac', 'audio/amr'
        ];
        
        // 最大文件大小 (2GB)
        this.maxFileSize = 2 * 1024 * 1024 * 1024;
        
        // 最大时长 (12小时，以秒为单位)
        this.maxDuration = 12 * 60 * 60;
    }

    /**
     * 验证音频文件
     * @param {File|Blob} file - 音频文件
     * @returns {Promise<Object>} 验证结果
     */
    async validateAudioFile(file) {
        const result = {
            valid: true,
            errors: []
        };

        // 检查文件大小
        if (file.size > this.maxFileSize) {
            result.valid = false;
            result.errors.push(`文件大小超过限制 (${this.formatFileSize(this.maxFileSize)})`);
        }

        // 检查文件类型
        if (!this.supportedFormats.includes(file.type)) {
            result.valid = false;
            result.errors.push(`不支持的音频格式: ${file.type}`);
        }

        // 检查音频时长（如果可能）
        try {
            const duration = await this.getAudioDuration(file);
            if (duration > this.maxDuration) {
                result.valid = false;
                result.errors.push(`音频时长超过限制 (${this.maxDuration / 3600}小时)`);
            }
        } catch (error) {
            console.warn('无法获取音频时长:', error);
        }

        return result;
    }

    /**
     * 获取音频时长
     * @param {File|Blob} file - 音频文件
     * @returns {Promise<number>} 时长（秒）
     */
    getAudioDuration(file) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            const url = URL.createObjectURL(file);
            
            audio.addEventListener('loadedmetadata', () => {
                URL.revokeObjectURL(url);
                resolve(audio.duration);
            });
            
            audio.addEventListener('error', () => {
                URL.revokeObjectURL(url);
                reject(new Error('无法加载音频文件'));
            });
            
            audio.src = url;
        });
    }

    /**
     * 上传文件到临时存储（模拟实现）
     * 在实际项目中，这里应该上传到阿里云OSS、AWS S3等云存储服务
     * @param {File|Blob} file - 音频文件
     * @param {Object} options - 上传选项
     * @returns {Promise<string>} 公网可访问的URL
     */
    async uploadToStorage(file, options = {}) {
        // 验证文件
        const validation = await this.validateAudioFile(file);
        if (!validation.valid) {
            throw new Error(`文件验证失败: ${validation.errors.join(', ')}`);
        }

        try {
            // 模拟上传过程
            const formData = new FormData();
            formData.append('audio', file);
            formData.append('timestamp', Date.now().toString());
            
            // 这里应该是实际的上传API端点
            // 例如：上传到你的后端服务，然后后端上传到OSS
            const uploadEndpoint = '/api/upload/audio'; // 需要后端实现
            
            const response = await fetch(uploadEndpoint, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`上传失败: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.url) {
                throw new Error('上传响应中缺少URL');
            }

            return result.url;
        } catch (error) {
            console.error('文件上传失败:', error);
            
            // 如果上传失败，尝试使用本地临时方案（仅用于开发测试）
            if (options.allowLocalFallback) {
                return this.createLocalUrl(file);
            }
            
            throw error;
        }
    }

    /**
     * 创建本地临时URL（仅用于开发测试）
     * 注意：这种方式生成的URL无法被外部服务访问
     * @param {File|Blob} file - 音频文件
     * @returns {string} 本地URL
     */
    createLocalUrl(file) {
        console.warn('使用本地URL，这仅适用于开发测试，无法被外部ASR服务访问');
        return URL.createObjectURL(file);
    }

    /**
     * 上传录音数据（从MediaRecorder获取）
     * @param {Blob} audioBlob - 录音数据
     * @param {Object} metadata - 录音元数据
     * @returns {Promise<string>} 公网可访问的URL
     */
    async uploadRecording(audioBlob, metadata = {}) {
        // 创建文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recording-${timestamp}.${this.getFileExtension(audioBlob.type)}`;
        
        // 创建File对象
        const file = new File([audioBlob], filename, { type: audioBlob.type });
        
        // 上传文件
        return await this.uploadToStorage(file, {
            metadata: {
                ...metadata,
                recordedAt: new Date().toISOString(),
                duration: metadata.duration || 0
            }
        });
    }

    /**
     * 批量上传文件
     * @param {Array<File>} files - 文件数组
     * @param {Object} options - 上传选项
     * @returns {Promise<Array>} 上传结果数组
     */
    async uploadMultiple(files, options = {}) {
        const results = [];
        const maxConcurrent = options.maxConcurrent || 3; // 最大并发数
        
        // 分批上传
        for (let i = 0; i < files.length; i += maxConcurrent) {
            const batch = files.slice(i, i + maxConcurrent);
            const batchPromises = batch.map(async (file, index) => {
                try {
                    const url = await this.uploadToStorage(file, options);
                    return {
                        file: file.name,
                        url: url,
                        status: 'success'
                    };
                } catch (error) {
                    return {
                        file: file.name,
                        error: error.message,
                        status: 'failed'
                    };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // 进度回调
            if (options.onProgress) {
                options.onProgress({
                    completed: results.length,
                    total: files.length,
                    percentage: Math.round((results.length / files.length) * 100)
                });
            }
        }
        
        return results;
    }

    /**
     * 根据MIME类型获取文件扩展名
     * @param {string} mimeType - MIME类型
     * @returns {string} 文件扩展名
     */
    getFileExtension(mimeType) {
        const extensions = {
            'audio/wav': 'wav',
            'audio/mp3': 'mp3',
            'audio/mpeg': 'mp3',
            'audio/m4a': 'm4a',
            'audio/aac': 'aac',
            'audio/ogg': 'ogg',
            'audio/webm': 'webm',
            'audio/flac': 'flac',
            'audio/amr': 'amr'
        };
        return extensions[mimeType] || 'audio';
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化的大小
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
     * 清理临时URL
     * @param {string} url - 要清理的URL
     */
    revokeUrl(url) {
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    }
}

// 导出上传服务实例
window.UploadService = UploadService;
