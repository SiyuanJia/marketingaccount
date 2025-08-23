// API服务封装
class APIService {
    constructor() {
        // API配置 - 实际使用时需要替换为真实的API密钥
        this.config = {
            // 阿里云DashScope配置（新的Paraformer ASR）
            dashscope: {
                apiKey: '', // 初始化为空，避免默认值误触发
                endpoint: 'https://dashscope.aliyuncs.com/api/v1'
            },

            // Gemini API配置（通过302.ai代理）
            gemini: {
                apiKey: '', // 初始化为空
                endpoint: 'https://api.302.ai/v1/chat/completions',
                model: 'gemini-2.5-flash'
            },

            // 飞书API配置
            feishu: {
                appId: 'YOUR_APP_ID',
                appSecret: 'YOUR_APP_SECRET',
                endpoint: 'https://open.feishu.cn/open-apis',
                appToken: '',
                tableId: '',
                accessToken: ''
            }
        };

        // 模拟模式开关（演示用）
        this.mockMode = false; // 现在默认使用真实API，如需演示可手动打开

        // 初始化ASR和上传服务
        this.asrService = window.ASRService ? new window.ASRService() : null;
        this.uploadService = window.SimpleUploadService ? new window.SimpleUploadService() : null;

        // 如果通过硬编码配置给了Key，则设置但不测试（默认我们已清空）
        if (this.asrService && this.config.dashscope.apiKey) {
            this.asrService.setApiKey(this.config.dashscope.apiKey, { test: false });
            this.mockMode = false;
        }

        // 从配置管理器加载API Keys
        if (window.configManager) {
            const dashscopeKey = window.configManager.getDashScopeApiKey();
            const geminiKey = window.configManager.getGeminiApiKey();
            const feishuConfig = window.configManager.getFeishuConfig();

            if (dashscopeKey) {
                // 初始化阶段从本地加载API Key，但不立刻触发在线测试
                this.asrService?.setApiKey(dashscopeKey, { test: false });
                this.config.dashscope.apiKey = dashscopeKey;
            }
            if (geminiKey) {
                this.setGeminiApiKey(geminiKey);
            }
            if (feishuConfig && Object.keys(feishuConfig).length > 0) {
                Object.assign(this.config.feishu, feishuConfig);
                console.log('✅ 飞书配置已加载:', Object.keys(feishuConfig));
            }
        }
    }

    // 确保服务已初始化
    ensureServicesInitialized() {
        if (!this.asrService && window.ASRService) {
            this.asrService = new window.ASRService();
            console.log('✅ ASR服务延迟初始化完成');
        }
        if (!this.uploadService && window.SimpleUploadService) {
            this.uploadService = new window.SimpleUploadService();
            console.log('✅ 上传服务延迟初始化完成');
        }
    }

    // ASR语音转文字 - 使用阿里云Paraformer
    async transcribeAudio(audioBlob, options = {}) {
        // 确保服务已初始化
        this.ensureServicesInitialized();

        if (this.mockMode || !this.asrService || !this.uploadService) {
            console.log('🔄 使用模拟模式 (ASR服务未配置或未初始化)');
            return this.mockASRResponse();
        }

        // 在发起真实调用前，探测本地代理是否可用
        try {
            const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            if (isDev) {
                const health = await fetch('http://localhost:3001/healthz', { method: 'GET' });
                if (!health.ok) throw new Error('proxy unhealthy');
            }
        } catch (e) {
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                console.warn('本地代理不可用，自动切换到模拟ASR模式');
                return this.mockASRResponse();
            }
        }

        // 恢复真实ASR调用，测试MP4格式是否可以成功
        console.log('🎤 尝试真实ASR识别（MP4格式）');

        try {
            // 0. 若包含 Opus 编码，先转 WAV，避免阿里云解码失败
            try {
                if (window.AudioUtils && typeof window.AudioUtils.convertToWavIfNeeded === 'function') {
                    audioBlob = await window.AudioUtils.convertToWavIfNeeded(audioBlob);
                }
            } catch (e) {
                console.warn('转 WAV 预处理失败，继续使用原始音频:', e);
            }

            // 1. 上传音频文件到公网可访问的存储
            console.log('上传音频文件...');
            const audioUrl = await this.uploadService.uploadAudio(audioBlob);

            // 2. 调用阿里云Paraformer ASR
            console.log('开始语音识别...');
            // 推断音频格式，透传给阿里云（有助于解码）
            let audioFormat = 'wav';
            const t = (audioBlob.type || '').toLowerCase();
            if (t.includes('mp3') || t.includes('mpeg')) audioFormat = 'mp3';
            else if (t.includes('m4a') || t.includes('mp4')) audioFormat = 'm4a';
            else if (t.includes('wav')) audioFormat = 'wav';

            const asrOptions = {
                languageHints: ["zh", "en"], // 中英文混合
                enableTimestamp: true, // 启用时间戳
                removeFillers: true, // 过滤语气词
                audioFormat, // 新增
                onProgress: (result) => {
                    console.log('ASR进度:', result.taskStatus);
                    // 可以在这里更新UI进度
                    if (options.onProgress) {
                        options.onProgress(result);
                    }
                }
            };

            const results = await this.asrService.recognize(audioUrl, asrOptions);

            // 3. 处理识别结果
            if (results.length === 0) {
                throw new Error('未获取到识别结果');
            }

            const result = results[0];
            if (result.status === 'failed') {
                throw new Error(result.error || '语音识别失败');
            }

            const transcription = result.transcription;
            const transcript = transcription.transcripts[0];

            return {
                text: transcript.text,
                confidence: 0.95, // Paraformer通常有很高的准确率
                segments: this.parseSegments(transcript.sentences),
                duration: transcription.properties.original_duration_in_milliseconds,
                audioFormat: transcription.properties.audio_format,
                samplingRate: transcription.properties.original_sampling_rate
            };

        } catch (error) {
            console.error('ASR转录失败:', error);
            // 失败时返回模拟数据
            return this.mockASRResponse();
        }
    }

    // 解析Paraformer的句子结果为段落格式
    parseSegments(sentences) {
        if (!sentences || sentences.length === 0) {
            return [];
        }

        return sentences.map(sentence => ({
            text: sentence.text,
            startTime: sentence.begin_time / 1000, // 转换为秒
            endTime: sentence.end_time / 1000,
            confidence: 0.95, // Paraformer通常有很高的准确率
            speakerId: sentence.speaker_id || 0, // 说话人ID（如果启用了说话人分离）
            words: sentence.words ? sentence.words.map(word => ({
                text: word.text,
                startTime: word.begin_time / 1000,
                endTime: word.end_time / 1000,
                punctuation: word.punctuation || ''
            })) : []
        }));
    }

    // 设置DashScope API Key
    setDashScopeApiKey(apiKey) {
        console.log('🔑 设置DashScope API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : '空值');
        this.config.dashscope.apiKey = apiKey;

        // 确保服务已初始化
        this.ensureServicesInitialized();

        if (this.asrService) {
            console.log('📡 向ASR服务设置API Key...');
            // 用户在设置页主动保存时，再进行测试（test: true）
            this.asrService.setApiKey(apiKey, { test: true });
            this.mockMode = false; // API Key有效，切换到真实模式
            console.log('✅ DashScope API Key已设置，切换到真实API模式');
        } else {
            console.warn('⚠️ ASR服务未初始化，API Key将在服务初始化时设置');
        }
    }

    // LLM文本分析
    async analyzeText(text) {
        if (this.mockMode || !this.config.gemini.apiKey || this.config.gemini.apiKey === 'YOUR_GEMINI_API_KEY') {
            console.log('🤖 使用模拟AI分析数据，转录文本长度:', text.length);
            return this.mockLLMResponse();
        }

        try {
            console.log('🤖 开始Gemini分析，转录文本长度:', text.length);
            console.log('🔑 Gemini API Key状态:', this.config.gemini.apiKey ? '已设置' : '未设置');
            const response = await this.callGeminiAPI(text);
            console.log('📥 Gemini原始响应:', response);
            const result = this.parseGeminiResponse(response);
            console.log('✅ Gemini解析结果:', result);
            return result;
        } catch (error) {
            console.error('❌ Gemini分析失败:', error);
            console.log('🔄 回退到模拟数据');
            return this.mockLLMResponse();
        }

        // 原始代码（暂时注释）
        /*
        if (this.mockMode) {
            return this.mockLLMResponse();
        }

        try {
            const prompt = this.buildAnalysisPrompt(text);
            const response = await this.callGeminiAPI(prompt);

            return this.parseAnalysisResponse(response);

        } catch (error) {
            console.error('LLM分析失败:', error);
            // 失败时返回模拟数据
            return this.mockLLMResponse();
        }
        */
    }

    // 检查代理服务器是否运行（复用ASR的代理服务器）
    async checkProxyServer() {
        try {
            const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            if (!isDev) return true; // 生产环境认为代理可用，由具体请求失败再兜底
            const response = await fetch('http://localhost:3001/healthz', {
                method: 'GET',
                timeout: 3000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // 检查飞书配置是否完整
    checkFeishuConfig() {
        const { appToken, tableId, accessToken } = this.config.feishu;

        if (!appToken) {
            return { valid: false, missing: '应用Token (App Token)' };
        }
        if (!tableId) {
            return { valid: false, missing: '表格ID (Table ID)' };
        }
        if (!accessToken) {
            return { valid: false, missing: '访问令牌 (Access Token)' };
        }

        return { valid: true };
    }

    // 同步到飞书多维表格
    async syncToFeishu(recordingData) {
        console.log('🚀 开始同步到飞书多维表格:', recordingData);

        try {
            // 检查代理服务器（复用ASR的代理服务器）
            const proxyRunning = await this.checkProxyServer();
            if (!proxyRunning) {
                throw new Error('代理服务器未运行。请先启动代理服务器：node proxy.js');
            }

            // 检查飞书配置
            const configCheck = this.checkFeishuConfig();
            if (!configCheck.valid) {
                throw new Error(`飞书配置不完整，缺少: ${configCheck.missing}。请在设置中配置飞书信息。`);
            }

            // 使用配置中的访问令牌
            const accessToken = this.config.feishu.accessToken;

            // 构建表格记录
            const record = this.buildFeishuRecord(recordingData);

            // 调用飞书API
            const response = await this.callFeishuAPI(accessToken, record);

            console.log('✅ 飞书同步成功:', response);
            return {
                success: true,
                data: response,
                message: '数据已成功导入飞书多维表格'
            };

        } catch (error) {
            console.error('❌ 飞书同步失败:', error);

            // 特殊处理代理服务器相关错误
            let errorMessage = error.message;
            if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
                errorMessage = '无法连接到代理服务器。请确保已启动代理服务器：node proxy.js';
            }

            return {
                success: false,
                error: error.message,
                message: `同步失败: ${errorMessage}`
            };
        }
    }

    // 阿里云ASR API调用
    async callAlicloudASR(base64Audio) {
        const url = `${this.config.alicloud.endpoint}/stream/v1/asr`;

        const requestBody = {
            appkey: this.config.alicloud.appKey,
            format: 'wav',
            sample_rate: 16000,
            audio: base64Audio
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.generateAlicloudAuth()
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`ASR API调用失败: ${response.status}`);
        }

        return await response.json();
    }

    // Gemini API调用（通过302.ai）
    async callGeminiAPI(text) {
        const prompt = this.buildAnalysisPrompt(text);
        console.log('📝 发送给Gemini的提示词:', prompt.substring(0, 200) + '...');

        const requestBody = {
            model: this.config.gemini.model,
            messages: [{
                role: 'user',
                content: prompt
            }],
            temperature: 0.4,
            max_tokens: 4096,
            response_format: { type: 'json_object' },
            stream: false
        };

        console.log('📤 Gemini请求体:', {
            model: requestBody.model,
            messageLength: requestBody.messages[0].content.length,
            endpoint: this.config.gemini.endpoint
        });

        const response = await fetch(this.config.gemini.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.gemini.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('📡 Gemini响应状态:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API错误响应:', errorText);
            throw new Error(`Gemini API调用失败: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('📥 Gemini完整响应:', result);
        // 如果 302.ai 返回了 stream=false 但仍包含分段标识或截断
        if (result?.choices?.[0]?.finish_reason === 'length') {
            console.warn('⚠️ 模型输出因长度被截断，建议增大 max_tokens 或缩短提示词');
        }
        return result;
    }
    // 构建银行营销案例分析提示词
    buildAnalysisPrompt(transcriptText) {
        return `你是一位资深的银行营销专家和培训师，请对以下银行客户经理的营销案例录音转录文本进行专业分析和提炼。

**转录文本：**
${transcriptText}

**分析要求：**
请严格按照以下JSON格式返回分析结果，不要添加任何其他文字说明：

{
  "summary": {
    "businessType": "业务类别（从以下选择：盘户计划、面访跟踪、优秀经验、失败复盘、其他）",
    "customerInfo": "客户姓名或称呼（如张总、李女士等，若未提及则填写'未提及'）",
    "followUpPlan": "待跟进计划（根据语音内容提炼具体的跟进行动，若没有提及则填写'未提及'）"
  },
  "insights": {
    "customerProfile": ["客户画像标签数组，如：中年、已婚、企业主、孩子小学等"],
    "demandStimulation": "需求激发亮点（分析客户需求激发过程中的成功做法和技巧）",
    "objectionHandling": "异议处理亮点（分析异议处理过程中的成功做法和技巧）",
    "customerTouchPoint": "打动客户的点（分析促使客户态度转变的关键节点和原因）",
    "failureReview": "失败复盘（若是失败案例，分析主要失败原因；若非失败案例则填写'未提及'）",
    "extendedThinking": "延伸思考（基于本案例提出深度洞察、可推广的方法论、营销技巧建议或行动提示。适当结合社会心理学和市场营销学理论，提供专业建议）"
  }
}

**注意事项：**
1. 严格按照JSON格式返回，确保格式正确
2. 如果某个字段在转录文本中没有相关信息，请填写"未提及"
3. 客户画像标签要简洁明了，每个标签2-4个字
4. 延伸思考要有深度，结合专业理论提供实用建议
5. 保持客观专业的分析态度`;
    }

    // 解析Gemini响应（302.ai chat/completions 兼容多形态）
    parseGeminiResponse(response) {
        try {
            console.log('🔍 开始解析Gemini响应...');

            const choice = response?.choices?.[0];
            if (!choice) {
                console.error('❌ 响应缺少 choices[0]:', response);
                throw new Error('响应缺少choices');
            }

            // 兼容多种返回形态提取文本（302.ai 对接 Gemini/各家模型时字段可能不同）
            let content = '';
            const msg = choice.message;
            const extractFromParts = (parts) => (parts || [])
                .map(p => {
                    if (typeof p === 'string') return p;
                    if (typeof p?.text === 'string') return p.text;
                    if (typeof p?.content === 'string') return p.content;
                    if (typeof p?.value === 'string') return p.value;
                    if (typeof p?.value?.text === 'string') return p.value.text;
                    return '';
                })
                .filter(Boolean)
                .join('\n');

            if (typeof msg?.content === 'string') {
                content = msg.content;
            } else if (Array.isArray(msg?.content)) {
                // OpenAI/302.ai: content 为数组 [{type:'text'|..., text|content: '...'}]
                content = extractFromParts(msg.content);
            } else if (Array.isArray(msg?.parts)) {
                // Gemini风格：message.parts
                content = extractFromParts(msg.parts);
            } else if (typeof choice.content === 'string') {
                // 有些实现把文本直接挂在 choice.content
                content = choice.content;
            } else if (Array.isArray(choice.content)) {
                content = extractFromParts(choice.content);
            } else if (typeof choice.text === 'string') {
                // 有些实现放在 choices[0].text（非chat）
                content = choice.text;
            } else if (typeof msg === 'string') {
                content = msg;
            }

            console.log('🧩 choice keys:', Object.keys(choice || {}), 'message keys:', msg ? Object.keys(msg) : null);
            console.log('📄 Gemini返回内容:', content);

            if (!content) {
                throw new Error('LLM未返回可解析文本');
            }

            // 提取JSON：优先```json fenced；不可靠时用括号配对提取
            const extractBalancedJson = (str) => {
                const start = str.indexOf('{');
                if (start < 0) return null;
                let i = start, depth = 0, inStr = false, esc = false;
                for (; i < str.length; i++) {
                    const ch = str[i];
                    if (inStr) {
                        if (esc) { esc = false; continue; }
                        if (ch === '\\') { esc = true; continue; }
                        if (ch === '"') { inStr = false; continue; }
                        continue;
                    } else {
                        if (ch === '"') { inStr = true; continue; }
                        if (ch === '{') { depth++; }
                        else if (ch === '}') { depth--; if (depth === 0) { return str.slice(start, i + 1); } }
                    }
                }
                return null; // 未能闭合
            };

            let jsonStr = null;
            const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
            if (fenced && fenced[1]) {
                jsonStr = fenced[1].trim();
            } else {
                jsonStr = extractBalancedJson(content);
                if (!jsonStr) {
                    const jsonMatch = content.match(/\{[\s\S]*\}/); // 最后兜底
                    jsonStr = jsonMatch ? jsonMatch[0] : null;
                }
            }

            if (!jsonStr) {
                console.error('❌ 未找到JSON格式内容');
                throw new Error('未找到JSON');
            }

            // 清理常见格式问题 + 规范化字符串内的换行/制表符
            const normalizeJsonString = (s) => {
                let out = '', inStr = false, esc = false;
                for (let i = 0; i < s.length; i++) {
                    const ch = s[i];
                    if (inStr) {
                        if (esc) { out += ch; esc = false; continue; }
                        if (ch === '\\') { out += ch; esc = true; continue; }
                        if (ch === '\n') { out += '\\n'; continue; }
                        if (ch === '\r') { continue; }
                        if (ch === '\t') { out += '\\t'; continue; }
                        // 处理其他控制字符
                        if (ch.charCodeAt(0) < 32 && ch !== '\n' && ch !== '\r' && ch !== '\t') {
                            continue; // 跳过其他控制字符
                        }
                    }
                    if (!esc && ch === '"') { inStr = !inStr; }
                    out += ch;
                }
                return out;
            };

            // 更强的JSON清理和修复
            const cleanJsonString = (str) => {
                let cleaned = normalizeJsonString(str)
                    .replace(/,\s*\}/g, '}')           // 移除对象末尾多余逗号
                    .replace(/,\s*\]/g, ']')           // 移除数组末尾多余逗号
                    .replace(/\}\s*\{/g, '},{')        // 修复缺失逗号的对象
                    .replace(/"\s*\n\s*"/g, '","')     // 修复跨行字符串
                    .trim();

                // 尝试修复常见的JSON格式问题
                try {
                    // 检查是否有未闭合的字符串
                    let inString = false;
                    let escaped = false;
                    let braceCount = 0;
                    let lastValidPos = 0;

                    for (let i = 0; i < cleaned.length; i++) {
                        const char = cleaned[i];

                        if (escaped) {
                            escaped = false;
                            continue;
                        }

                        if (char === '\\') {
                            escaped = true;
                            continue;
                        }

                        if (char === '"') {
                            inString = !inString;
                            continue;
                        }

                        if (!inString) {
                            if (char === '{') {
                                braceCount++;
                            } else if (char === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                    lastValidPos = i + 1;
                                }
                            }
                        }
                    }

                    // 如果JSON没有正确闭合，截取到最后一个有效位置
                    if (braceCount > 0 && lastValidPos > 0) {
                        console.log('🔧 检测到未闭合的JSON，截取到最后有效位置:', lastValidPos);
                        cleaned = cleaned.substring(0, lastValidPos);
                    }

                } catch (e) {
                    console.warn('🔧 JSON修复过程中出错:', e.message);
                }

                return cleaned;
            };

            jsonStr = cleanJsonString(jsonStr);

            console.log('🎯 找到JSON内容 长度:', jsonStr.length);
            console.log('🔍 JSON内容预览:', jsonStr.substring(0, 500) + (jsonStr.length > 500 ? '...' : ''));
            console.log('🔍 JSON内容末尾:', jsonStr.substring(Math.max(0, jsonStr.length - 200)));

            // 先尝试解析；失败则尝试用括号配对重新提取一次
            let analysisData;
            try {
                analysisData = JSON.parse(jsonStr);
            } catch (e) {
                console.warn('⚠️ 直接解析失败，尝试括号配对再提取一次');
                console.error('🔍 JSON解析错误详情:', e.message);
                console.log('🔍 错误位置附近的内容:', jsonStr.substring(Math.max(0, 1324 - 50), 1324 + 50));

                const retried = extractBalancedJson(content);
                if (!retried) throw e;
                const cleaned = cleanJsonString(retried);
                console.log('🔁 重抽取JSON 长度:', cleaned.length);
                console.log('🔍 重抽取JSON预览:', cleaned.substring(0, 500) + (cleaned.length > 500 ? '...' : ''));
                try {
                    analysisData = JSON.parse(cleaned);
                } catch (e2) {
                    console.error('🔍 重试解析也失败:', e2.message);
                    console.log('🔍 最终JSON内容:', cleaned);

                    // 最后的fallback：尝试从原始内容中提取关键信息
                    console.log('🔧 尝试使用正则表达式提取关键信息...');
                    const fallbackData = this.extractDataWithRegex(content);
                    if (fallbackData) {
                        console.log('✅ 正则表达式提取成功:', fallbackData);
                        analysisData = fallbackData;
                    } else {
                        throw e2;
                    }
                }
            }

            console.log('📊 解析后的数据结构:', analysisData);

            // 转换为内部格式（兼容嵌套/扁平）
            const hasNested = analysisData.summary || analysisData.insights;
            let result;
            if (hasNested) {
                const s = analysisData.summary || {};
                const i = analysisData.insights || {};
                result = {
                    businessType: s.businessType || '其他',
                    customerInfo: {
                        name: (typeof s.customerInfo === 'string' ? s.customerInfo : s.customerInfo?.name) || '未提及',
                        customerId: (typeof s.customerInfo === 'object' ? (s.customerInfo?.customerId || '') : '') || ('AUTO_' + Date.now())
                    },
                    followUpPlan: s.followUpPlan || '未提及',
                    customerProfile: Array.isArray(i.customerProfile)
                        ? i.customerProfile
                        : (typeof i.customerProfile === 'string' ? i.customerProfile.split(/[\,\s]+/).filter(Boolean) : ['未提及']),
                    optionalFields: {
                        demandStimulation: i.demandStimulation || '未提及',
                        objectionHandling: i.objectionHandling || '未提及',
                        customerTouchPoint: i.customerTouchPoint || '未提及',
                        failureReview: i.failureReview || '未提及',
                        extendedThinking: i.extendedThinking || '未提及'
                    }
                };
            } else {
                const cf = analysisData.customerInfo;
                const cp = analysisData.customerProfile;
                const opt = analysisData.optionalFields || {};
                result = {
                    businessType: analysisData.businessType || '其他',
                    customerInfo: {
                        name: (typeof cf === 'string' ? cf : cf?.name) || '未提及',
                        customerId: (typeof cf === 'object' ? (cf?.customerId || '') : '') || ('AUTO_' + Date.now())
                    },
                    followUpPlan: analysisData.followUpPlan || '未提及',
                    customerProfile: Array.isArray(cp) ? cp : (typeof cp === 'string' ? cp.split(/[\,\s]+/).filter(Boolean) : ['未提及']),
                    optionalFields: {
                        demandStimulation: opt.demandStimulation || '未提及',
                        objectionHandling: opt.objectionHandling || '未提及',
                        customerTouchPoint: opt.customerTouchPoint || '未提及',
                        failureReview: opt.failureReview || '未提及',
                        extendedThinking: opt.extendedThinking || '未提及'
                    }
                };
            }

            console.log('✅ 转换后的内部格式:', result);
            return result;
        } catch (error) {
            console.error('❌ 解析Gemini响应失败:', error);
            throw error;
        }
    }

    // 使用正则表达式从文本中提取关键信息（fallback方法）
    extractDataWithRegex(content) {
        try {
            console.log('🔧 开始正则表达式提取...');

            const result = {
                businessType: '其他',
                customerInfo: {
                    name: '未提及',
                    customerId: 'AUTO_' + Date.now()
                },
                followUpPlan: '未提及',
                customerProfile: [],
                optionalFields: {
                    demandStimulation: '未提及',
                    objectionHandling: '未提及',
                    customerTouchPoint: '未提及',
                    failureReview: '未提及',
                    extendedThinking: '未提及'
                }
            };

            // 提取业务类别
            const businessTypeMatch = content.match(/["']?businessType["']?\s*:\s*["']([^"']+)["']/i);
            if (businessTypeMatch) {
                result.businessType = businessTypeMatch[1];
            }

            // 提取客户姓名
            const customerNameMatch = content.match(/["']?name["']?\s*:\s*["']([^"']+)["']/i) ||
                                    content.match(/客户[姓名称呼]*[:：]\s*([^\s,，。]+)/);
            if (customerNameMatch) {
                result.customerInfo.name = customerNameMatch[1];
            }

            // 提取跟进计划
            const followUpMatch = content.match(/["']?followUpPlan["']?\s*:\s*["']([^"']+)["']/i) ||
                                content.match(/跟进[计划规划]*[:：]\s*([^"'，。]+)/);
            if (followUpMatch) {
                result.followUpPlan = followUpMatch[1];
            }

            // 提取客户画像（数组格式）
            const profileMatch = content.match(/["']?customerProfile["']?\s*:\s*\[([^\]]+)\]/i);
            if (profileMatch) {
                const profileStr = profileMatch[1];
                result.customerProfile = profileStr.split(',')
                    .map(item => item.trim().replace(/["']/g, ''))
                    .filter(Boolean);
            }

            // 提取可选字段
            const optionalFields = ['demandStimulation', 'objectionHandling', 'customerTouchPoint', 'failureReview', 'extendedThinking'];
            optionalFields.forEach(field => {
                const regex = new RegExp(`["']?${field}["']?\\s*:\\s*["']([^"']+)["']`, 'i');
                const match = content.match(regex);
                if (match) {
                    result.optionalFields[field] = match[1];
                }
            });

            console.log('🔧 正则表达式提取结果:', result);

            // 检查是否提取到了有效信息
            const hasValidData = result.businessType !== '其他' ||
                                result.customerInfo.name !== '未提及' ||
                                result.followUpPlan !== '未提及' ||
                                result.customerProfile.length > 0;

            return hasValidData ? result : null;

        } catch (error) {
            console.error('🔧 正则表达式提取失败:', error);
            return null;
        }
    }

    // 设置Gemini API Key
    setGeminiApiKey(apiKey) {
        this.config.gemini.apiKey = apiKey;
        if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY') {
            console.log('✅ Gemini API Key已设置');
        }
    }

    // 飞书API调用（复用ASR的代理服务器）
    async callFeishuAPI(accessToken, record) {
        const originalUrl = `${this.config.feishu.endpoint}/bitable/v1/apps/${this.config.feishu.appToken}/tables/${this.config.feishu.tableId}/records`;

        // 使用与ASR相同的代理服务器格式
        let proxyBase;
        if (window.proxyConfig && typeof window.proxyConfig.getAvailableProxy === 'function') {
            try { proxyBase = await window.proxyConfig.getAvailableProxy(); } catch (_) {}
        }
        if (!proxyBase) {
            const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            proxyBase = isDev ? 'http://localhost:3001' : 'https://marketingaccount.vercel.app/api/proxy';
        }
        const proxyUrl = `${proxyBase}?url=${encodeURIComponent(originalUrl)}`;

        console.log('📤 飞书API请求:', {
            originalUrl,
            proxyUrl,
            fields: Object.keys(record),
            recordCount: Object.keys(record).length
        });

        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: record
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 飞书API错误:', {
                status: response.status,
                statusText: response.statusText,
                errorText
            });
            throw new Error(`飞书API调用失败: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ 飞书API响应:', result);
        return result;
    }

    // 解析LLM分析响应
    parseAnalysisResponse(response) {
        try {
            const content = response.candidates[0].content.parts[0].text;
            // 提取JSON部分
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('无法解析LLM响应');
            }
        } catch (error) {
            console.error('解析LLM响应失败:', error);
            return this.mockLLMResponse();
        }
    }

    // 构建飞书表格记录
    buildFeishuRecord(recordingData) {
        const analysis = recordingData.analysis;

        // 根据你的示例，业务类别需要是数组格式
        const businessTypeArray = analysis.businessType ? [analysis.businessType] : ["未分类"];

        // 客户画像拼接成字符串
        const customerProfileStr = Array.isArray(analysis.customerProfile)
            ? analysis.customerProfile.join("｜")
            : (analysis.customerProfile || "");

        const record = {
            "业务类别": businessTypeArray,
            "客户姓名": analysis.customerInfo?.name || "未提及",
            "客户画像": customerProfileStr,
            "跟进计划": analysis.followUpPlan || "未提及",
            "需求激发": analysis.optionalFields?.demandStimulation || "未提及",
            "异议处理": analysis.optionalFields?.objectionHandling || "未提及",
            "打动客户的点": analysis.optionalFields?.customerTouchPoint || "未提及",
            "失败复盘": analysis.optionalFields?.failureReview || "未提及",
            "延伸思考": analysis.optionalFields?.extendedThinking || "未提及",
            "转录文本": recordingData.transcription?.text || recordingData.text || "无转录文本"
        };

        console.log('📋 构建的飞书记录:', record);
        return record;
    }

    // 获取飞书访问令牌
    async getFeishuAccessToken() {
        const url = `${this.config.feishu.endpoint}/auth/v3/tenant_access_token/internal`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app_id: this.config.feishu.appId,
                app_secret: this.config.feishu.appSecret
            })
        });

        const data = await response.json();
        return data.tenant_access_token;
    }

    // 生成阿里云认证头
    generateAlicloudAuth() {
        // 这里应该实现阿里云的签名算法
        // 为了简化演示，这里返回一个占位符
        return 'Bearer YOUR_ACCESS_TOKEN';
    }

    // 模拟ASR响应
    mockASRResponse() {
        // 模拟延迟
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    text: "今天我拜访了张总，他是一家制造业公司的老板，45岁左右，已婚，有两个孩子在上中学。张总对我们的产品很感兴趣，特别是我提到的风险保障功能，他说最近行业竞争激烈，确实需要为家庭和企业做一些保障规划。不过他提出了保费预算的问题，希望能有更灵活的缴费方式。我建议他可以考虑分期缴费，并且承诺下周给他准备一个详细的方案。整体来说这次面访效果不错，客户意向度比较高。",
                    confidence: 0.95,
                    segments: []
                });
            }, 2000);
        });
    }

    // 模拟AI分析响应
    mockAnalysisResponse() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    summary: {
                        keyPoints: [
                            "客户张总，制造业公司老板，45岁，已婚，两个中学生孩子",
                            "对产品感兴趣，特别关注风险保障功能",
                            "提出保费预算问题，希望灵活缴费方式",
                            "承诺下周提供详细方案，客户意向度高"
                        ],
                        sentiment: "积极",
                        confidence: 0.92
                    },
                    customerProfile: {
                        basicInfo: {
                            name: "张总",
                            age: "45岁左右",
                            industry: "制造业",
                            position: "公司老板",
                            maritalStatus: "已婚",
                            children: "两个中学生孩子"
                        },
                        needs: [
                            "风险保障功能",
                            "灵活的缴费方式",
                            "家庭和企业保障规划"
                        ],
                        concerns: [
                            "保费预算问题",
                            "行业竞争激烈"
                        ],
                        intent: "高意向度"
                    },
                    actionItems: [
                        "下周准备详细的保障方案",
                        "提供分期缴费选项",
                        "针对制造业风险特点定制方案",
                        "跟进客户预算范围"
                    ]
                });
            }, 1500);
        });
    }

    // 模拟LLM响应
    mockLLMResponse() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    businessType: "面访跟踪",
                    customerInfo: {
                        name: "张总",
                        customerId: "未提及"
                    },
                    customerProfile: ["中年", "已婚", "企业主", "孩子中学", "制造业"],
                    followUpPlan: "下周准备详细保障方案，重点突出分期缴费的灵活性，针对制造业风险特点定制产品组合",
                    optionalFields: {
                        demandStimulation: "通过行业竞争激烈的现状，激发客户对风险保障的需求",
                        objectionHandling: "针对保费预算问题，提供分期缴费解决方案",
                        customerTouchPoint: "风险保障功能引起客户强烈兴趣，是主要打动点",
                        extendedThinking: "可以考虑针对制造业客户群体开发专门的产品包，突出行业特色"
                    }
                });
            }, 3000);
        });
    }

    // 模拟飞书响应
    mockFeishuResponse() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    code: 0,
                    msg: "success",
                    data: {
                        record: {
                            record_id: "rec" + Date.now()
                        }
                    }
                });
            }, 1000);
        });
    }
}

// 初始化全局API服务实例
window.apiService = new APIService();
console.log('✅ API服务初始化完成');
console.log('📡 上传服务状态:', window.apiService.uploadService.getStatus());
console.log('🔑 配置状态:', window.configManager ? window.configManager.isConfigured() : '配置管理器未加载');
