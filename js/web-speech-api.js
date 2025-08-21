/**
 * 浏览器原生Web Speech API
 * 无需后端，直接在浏览器中进行语音识别
 * 适用于产品原型快速验证
 */

class WebSpeechService {
    constructor() {
        // 检查浏览器支持
        this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        
        if (this.isSupported) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.setupRecognition();
        }
        
        this.isRecording = false;
        this.results = [];
        this.onResult = null;
        this.onError = null;
        this.onEnd = null;
    }

    /**
     * 设置语音识别参数
     */
    setupRecognition() {
        // 基本配置
        this.recognition.continuous = true; // 持续识别
        this.recognition.interimResults = true; // 返回临时结果
        this.recognition.maxAlternatives = 1; // 最大候选数
        
        // 语言设置 - 支持中文
        this.recognition.lang = 'zh-CN'; // 默认中文
        
        // 事件监听
        this.recognition.onstart = () => {
            console.log('Web Speech API 开始识别');
            this.isRecording = true;
        };

        this.recognition.onresult = (event) => {
            this.handleResults(event);
        };

        this.recognition.onerror = (event) => {
            console.error('Web Speech API 错误:', event.error);
            this.isRecording = false;
            if (this.onError) {
                this.onError(event.error);
            }
        };

        this.recognition.onend = () => {
            console.log('Web Speech API 识别结束');
            this.isRecording = false;
            if (this.onEnd) {
                this.onEnd(this.getFinalResult());
            }
        };
    }

    /**
     * 处理识别结果
     */
    handleResults(event) {
        let finalTranscript = '';
        let interimTranscript = '';

        // 处理所有结果
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            
            if (result.isFinal) {
                finalTranscript += transcript;
                this.results.push({
                    text: transcript,
                    confidence: result[0].confidence,
                    timestamp: Date.now(),
                    isFinal: true
                });
            } else {
                interimTranscript += transcript;
            }
        }

        // 实时回调
        if (this.onResult) {
            this.onResult({
                final: finalTranscript,
                interim: interimTranscript,
                results: this.results
            });
        }
    }

    /**
     * 开始语音识别
     */
    start(options = {}) {
        if (!this.isSupported) {
            throw new Error('浏览器不支持Web Speech API');
        }

        if (this.isRecording) {
            console.warn('语音识别已在进行中');
            return;
        }

        // 重置结果
        this.results = [];
        
        // 设置语言
        if (options.language) {
            this.recognition.lang = options.language;
        }

        // 设置回调
        this.onResult = options.onResult;
        this.onError = options.onError;
        this.onEnd = options.onEnd;

        try {
            this.recognition.start();
        } catch (error) {
            console.error('启动语音识别失败:', error);
            throw error;
        }
    }

    /**
     * 停止语音识别
     */
    stop() {
        if (this.isRecording && this.recognition) {
            this.recognition.stop();
        }
    }

    /**
     * 获取最终结果
     */
    getFinalResult() {
        const finalResults = this.results.filter(r => r.isFinal);
        const fullText = finalResults.map(r => r.text).join(' ');
        
        return {
            text: fullText,
            confidence: finalResults.length > 0 ? 
                finalResults.reduce((sum, r) => sum + (r.confidence || 0.8), 0) / finalResults.length : 0.8,
            segments: finalResults.map((r, index) => ({
                text: r.text,
                startTime: index * 2, // 模拟时间戳
                endTime: (index + 1) * 2,
                confidence: r.confidence || 0.8
            })),
            duration: finalResults.length * 2000, // 模拟时长
            source: 'Web Speech API'
        };
    }

    /**
     * 设置语言
     */
    setLanguage(language) {
        const supportedLanguages = {
            'zh-CN': '中文(普通话)',
            'zh-TW': '中文(台湾)',
            'zh-HK': '中文(香港)',
            'en-US': 'English (US)',
            'en-GB': 'English (UK)',
            'ja-JP': '日本語',
            'ko-KR': '한국어'
        };

        if (supportedLanguages[language]) {
            this.recognition.lang = language;
            return true;
        }
        
        console.warn(`不支持的语言: ${language}`);
        return false;
    }

    /**
     * 获取支持的语言列表
     */
    getSupportedLanguages() {
        return {
            'zh-CN': '中文(普通话)',
            'zh-TW': '中文(台湾)',
            'zh-HK': '中文(香港)',
            'en-US': 'English (US)',
            'en-GB': 'English (UK)',
            'ja-JP': '日本語',
            'ko-KR': '한국어',
            'fr-FR': 'Français',
            'de-DE': 'Deutsch',
            'es-ES': 'Español',
            'it-IT': 'Italiano',
            'pt-BR': 'Português (Brasil)',
            'ru-RU': 'Русский'
        };
    }

    /**
     * 检查浏览器兼容性
     */
    static checkCompatibility() {
        const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
        
        return {
            supported: isSupported,
            secure: isSecure,
            ready: isSupported && isSecure,
            message: !isSupported ? '浏览器不支持Web Speech API' :
                    !isSecure ? '需要HTTPS环境或localhost' : '可以使用'
        };
    }

    /**
     * 获取服务状态
     */
    getStatus() {
        return {
            supported: this.isSupported,
            recording: this.isRecording,
            language: this.recognition ? this.recognition.lang : null,
            resultsCount: this.results.length
        };
    }
}

// 导出服务
window.WebSpeechService = WebSpeechService;
