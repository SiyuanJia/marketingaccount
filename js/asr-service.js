/**
 * 阿里云Paraformer ASR服务
 * 基于RESTful API实现语音识别功能
 */

class ASRService {
    constructor() {
        // 阿里云DashScope API配置
        this.baseURL = 'https://dashscope.aliyuncs.com/api/v1';
        this.model = 'paraformer-v2'; // 使用推荐的v2模型
        this.apiKey = null; // 需要从环境变量或配置中获取

        // 代理配置（用于解决CORS问题）
        this.proxyURL = null; // 将在首次使用时异步获取
        this.useProxy = true; // 是否使用代理

        // 临时测试模式（如果代理有问题，可以设置为true）
        this.testMode = false;
        
        // 任务状态常量
        this.TASK_STATUS = {
            PENDING: 'PENDING',
            RUNNING: 'RUNNING',
            SUCCEEDED: 'SUCCEEDED',
            FAILED: 'FAILED'
        };
    }

    /**
     * 获取代理URL - 自动检测环境
     */
    async getProxyURL() {
        // 简单的环境检测，避免复杂的代理测试
        const isDev = window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1';

        if (isDev) {
            // 开发环境：使用本地代理
            console.log('🔧 开发环境，使用本地代理: http://localhost:3001');
            return 'http://localhost:3001';
        } else {
            // 生产环境：需要您部署代理服务并替换这个URL
            console.log('🌐 生产环境，使用云端代理');
            return 'https://your-proxy-domain.vercel.app/api';
        }
    }

    /**
     * 设置API Key
     * @param {string} apiKey - 阿里云DashScope API Key
     * @param {{test?: boolean}} [options] - 选项：是否立即测试Key（默认true）
     */
    setApiKey(apiKey, options = { test: true }) {
        console.log('🔑 ASR服务接收API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '空值');
        this.apiKey = apiKey;
        console.log('✅ ASR API Key已设置');

        // 是否立即测试
        const shouldTest = options?.test !== false;
        if (shouldTest) {
            // 测试API Key有效性
            this.testApiKey();
        } else {
            console.log('⏸️ 跳过API Key即时测试（silent 模式）');
        }
    }

    // 测试API Key有效性
    async testApiKey() {
        if (!this.apiKey) {
            console.warn('⚠️ 无法测试API Key：未设置');
            return;
        }

        try {
            console.log('🧪 测试API Key有效性...');
            const testUrl = 'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';

            // 确保获取到代理URL
            if (this.useProxy && !this.proxyURL) {
                this.proxyURL = await this.getProxyURL();
            }

            const proxyUrl = this.useProxy ?
                `${this.proxyURL}?url=${encodeURIComponent(testUrl)}` :
                testUrl;

            // 发送一个简单的测试请求（会失败，但能验证认证）
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'X-DashScope-Async': 'enable'
                },
                body: JSON.stringify({
                    model: 'paraformer-realtime-v2',
                    input: {
                        source_language: 'auto',
                        task: 'transcription',
                        file_urls: ['https://example.com/test.wav'] // 假的URL，用于测试认证
                    }
                })
            });

            if (response.status === 401) {
                console.error('❌ API Key无效或权限不足');
            } else if (response.status === 400) {
                console.log('✅ API Key有效（收到400错误是因为测试URL无效，这是预期的）');
            } else {
                console.log(`🔍 API Key测试响应状态: ${response.status}`);
            }
        } catch (error) {
            console.warn('⚠️ API Key测试失败:', error.message);
        }
    }

    /**
     * 提交语音识别任务
     * @param {string|Array} fileUrls - 音频文件的公网可访问URL(s)
     * @param {Object} options - 可选参数
     * @returns {Promise<Object>} 返回任务ID和状态
     */
    async submitTask(fileUrls, options = {}) {
        console.log('🔍 检查API Key状态:', this.apiKey ? `已设置 (${this.apiKey.substring(0, 10)}...)` : '未设置');
        if (!this.apiKey) {
            throw new Error('API Key未设置，请先调用setApiKey()方法');
        }

        // 确保fileUrls是数组格式
        const urls = Array.isArray(fileUrls) ? fileUrls : [fileUrls];
        
        // 验证URL格式
        for (const url of urls) {
            if (!this.isValidUrl(url)) {
                throw new Error(`无效的URL格式: ${url}`);
            }
        }

        const requestData = {
            model: this.model,
            input: {
                file_urls: urls
            },
            parameters: {
                channel_id: options.channelId || [0], // 音轨索引
                language_hints: options.languageHints || ["zh", "en"], // 语言提示
                disfluency_removal_enabled: options.removeFillers || false, // 过滤语气词
                timestamp_alignment_enabled: options.enableTimestamp || true, // 时间戳校准
                diarization_enabled: options.enableSpeakerSeparation || false, // 说话人分离
                speaker_count: options.speakerCount || undefined, // 说话人数量
                audio_format: options.audioFormat || undefined // 显式传递音频格式
            }
        };

        // 如果有热词ID，添加到参数中
        if (options.vocabularyId) {
            requestData.parameters.vocabulary_id = options.vocabularyId;
        }

        try {
            const targetURL = `${this.baseURL}/services/audio/asr/transcription`;

            // 确保获取到代理URL
            if (this.useProxy && !this.proxyURL) {
                this.proxyURL = await this.getProxyURL();
            }

            const requestURL = this.useProxy ?
                `${this.proxyURL}?url=${encodeURIComponent(targetURL)}` :
                targetURL;

            console.log('🔗 ASR请求配置:');
            console.log('  - 使用代理:', this.useProxy);
            console.log('  - 代理地址:', this.proxyURL);
            console.log('  - 目标URL:', targetURL);
            console.log('  - 实际请求URL:', requestURL);
            console.log('  - API Key前缀:', this.apiKey ? this.apiKey.substring(0, 10) + '...' : '未设置');
            console.log('  - 请求数据:', requestData);

            const headers = {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable' // 必须的异步请求头
            };

            console.log('  - 请求头:', headers);

            const response = await fetch(requestURL, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                let errorMessage = response.statusText;
                try {
                    const errorData = await response.json();
                    console.error('❌ ASR API错误响应:', errorData);
                    errorMessage = errorData.message || errorData.error || response.statusText;
                } catch (e) {
                    console.error('❌ 无法解析错误响应:', e);
                    const errorText = await response.text();
                    console.error('❌ 错误响应文本:', errorText);
                }
                throw new Error(`提交任务失败: ${errorMessage}`);
            }

            const result = await response.json();
            return {
                taskId: result.output.task_id,
                taskStatus: result.output.task_status,
                requestId: result.request_id
            };
        } catch (error) {
            console.error('提交ASR任务失败:', error);
            throw error;
        }
    }

    /**
     * 查询任务状态和结果
     * @param {string} taskId - 任务ID
     * @returns {Promise<Object>} 任务状态和结果
     */
    async queryTask(taskId) {
        if (!this.apiKey) {
            throw new Error('API Key未设置，请先调用setApiKey()方法');
        }

        if (!taskId) {
            throw new Error('任务ID不能为空');
        }

        try {
            const targetURL = `${this.baseURL}/tasks/${taskId}`;

            // 确保获取到代理URL
            if (this.useProxy && !this.proxyURL) {
                this.proxyURL = await this.getProxyURL();
            }

            const requestURL = this.useProxy ?
                `${this.proxyURL}?url=${encodeURIComponent(targetURL)}` :
                targetURL;

            console.log('🔍 查询任务请求:', requestURL);

            const response = await fetch(requestURL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`查询任务失败: ${errorData.message || response.statusText}`);
            }

            const result = await response.json();
            return {
                taskId: result.output.task_id,
                taskStatus: result.output.task_status,
                submitTime: result.output.submit_time,
                endTime: result.output.end_time,
                results: result.output.results,
                taskMetrics: result.output.task_metrics,
                usage: result.usage,
                requestId: result.request_id
            };
        } catch (error) {
            console.error('查询ASR任务失败:', error);
            throw error;
        }
    }

    /**
     * 轮询等待任务完成
     * @param {string} taskId - 任务ID
     * @param {Object} options - 轮询选项
     * @returns {Promise<Object>} 最终结果
     */
    async waitForCompletion(taskId, options = {}) {
        const maxAttempts = options.maxAttempts || 60; // 最大尝试次数
        const interval = options.interval || 2000; // 轮询间隔(ms)
        const onProgress = options.onProgress; // 进度回调

        let attempts = 0;
        
        while (attempts < maxAttempts) {
            try {
                const result = await this.queryTask(taskId);
                
                // 调用进度回调
                if (onProgress) {
                    onProgress(result);
                }

                // 检查任务状态
                if (result.taskStatus === this.TASK_STATUS.SUCCEEDED) {
                    return result;
                } else if (result.taskStatus === this.TASK_STATUS.FAILED) {
                    console.error('❌ 任务执行失败，详细信息:', result);
                    throw new Error(`任务执行失败: ${JSON.stringify(result.results || result)}`);
                } else if (result.taskStatus === this.TASK_STATUS.PENDING ||
                          result.taskStatus === this.TASK_STATUS.RUNNING) {
                    // 任务还在进行中，继续等待
                    await this.sleep(interval);
                    attempts++;
                } else {
                    throw new Error(`未知的任务状态: ${result.taskStatus}`);
                }
            } catch (error) {
                console.error(`轮询第${attempts + 1}次失败:`, error);
                attempts++;
                if (attempts >= maxAttempts) {
                    throw new Error(`轮询超时，已尝试${maxAttempts}次`);
                }
                await this.sleep(interval);
            }
        }
        
        throw new Error(`任务超时，已等待${maxAttempts * interval / 1000}秒`);
    }

    /**
     * 获取识别结果详情
     * @param {string} transcriptionUrl - 识别结果URL
     * @returns {Promise<Object>} 详细的识别结果
     */
    async getTranscriptionResult(transcriptionUrl) {
        try {
            const response = await fetch(transcriptionUrl);
            if (!response.ok) {
                throw new Error(`获取识别结果失败: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('获取识别结果失败:', error);
            throw error;
        }
    }

    /**
     * 完整的语音识别流程
     * @param {string|Array} fileUrls - 音频文件URL(s)
     * @param {Object} options - 选项参数
     * @returns {Promise<Array>} 识别结果数组
     */
    async recognize(fileUrls, options = {}) {
        try {
            // 1. 提交任务
            console.log('提交语音识别任务...');
            const submitResult = await this.submitTask(fileUrls, options);
            console.log('任务已提交，任务ID:', submitResult.taskId);

            // 2. 等待任务完成
            console.log('等待任务完成...');
            const completionResult = await this.waitForCompletion(submitResult.taskId, {
                onProgress: (result) => {
                    console.log(`任务状态: ${result.taskStatus}`);
                    if (options.onProgress) {
                        options.onProgress(result);
                    }
                }
            });

            // 3. 获取详细结果
            const detailedResults = [];
            for (const result of completionResult.results) {
                if (result.subtask_status === 'SUCCEEDED' && result.transcription_url) {
                    const transcription = await this.getTranscriptionResult(result.transcription_url);
                    detailedResults.push({
                        fileUrl: result.file_url,
                        transcription: transcription,
                        status: 'success'
                    });
                } else {
                    detailedResults.push({
                        fileUrl: result.file_url,
                        error: result.message || '识别失败',
                        code: result.code,
                        status: 'failed'
                    });
                }
            }

            return detailedResults;
        } catch (error) {
            console.error('语音识别流程失败:', error);
            throw error;
        }
    }

    /**
     * 验证URL格式
     * @param {string} url - 待验证的URL
     * @returns {boolean} 是否为有效URL
     */
    isValidUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * 睡眠函数
     * @param {number} ms - 毫秒数
     * @returns {Promise}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 导出ASR服务实例
window.ASRService = ASRService;
