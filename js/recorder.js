// 音频录制功能
class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this.isRecording = false;
    }

    async startRecording() {
        try {
            // 请求麦克风权限
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });

            // 检查浏览器支持的MIME类型
            const mimeType = this.getSupportedMimeType();

            // 创建MediaRecorder实例
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: mimeType,
                audioBitsPerSecond: 128000 // 设置音频比特率
            });

            // 重置音频块数组
            this.audioChunks = [];
            this.recordingStartTime = Date.now();

            // 设置事件监听器
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('录音停止，总时长:', Date.now() - this.recordingStartTime, 'ms');
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('录音错误:', event.error);
            };

            // 开始录音
            this.mediaRecorder.start(100); // 每100ms收集一次数据，提高音质
            this.isRecording = true;

            console.log('录音开始，MIME类型:', mimeType);

        } catch (error) {
            console.error('无法启动录音:', error);
            if (error.name === 'NotAllowedError') {
                throw new Error('麦克风权限被拒绝，请在浏览器设置中允许麦克风访问');
            } else if (error.name === 'NotFoundError') {
                throw new Error('未找到麦克风设备，请检查设备连接');
            } else {
                throw new Error('无法访问麦克风，请检查权限设置');
            }
        }
    }

    async stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder || !this.isRecording) {
                reject(new Error('没有正在进行的录音'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                try {
                    // 创建音频Blob
                    const mimeType = this.mediaRecorder.mimeType;
                    const audioBlob = new Blob(this.audioChunks, { type: mimeType });
                    
                    // 停止所有音频轨道
                    this.stream.getTracks().forEach(track => track.stop());
                    
                    // 重置状态
                    this.isRecording = false;
                    this.mediaRecorder = null;
                    this.stream = null;
                    
                    console.log('录音完成，文件大小:', audioBlob.size, 'bytes');
                    resolve(audioBlob);
                    
                } catch (error) {
                    reject(error);
                }
            };

            // 停止录音
            this.mediaRecorder.stop();
        });
    }

    getSupportedMimeType() {
        // 按优先级检查支持的MIME类型（优先使用阿里云ASR支持的格式）
        const mimeTypes = [
            'audio/wav',                    // 最佳兼容性，阿里云ASR首选
            'audio/mpeg',                   // MP3格式，广泛支持
            'audio/mp4',                    // M4A格式
            'audio/mp4;codecs=mp4a.40.2',   // 带编码器的MP4
            'audio/webm',                   // WebM格式
            'audio/webm;codecs=vp8,opus',   // 带编码器的WebM
            'audio/webm;codecs=opus'        // 可能有解码问题，最后选择
        ];

        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                console.log('选择的音频格式:', mimeType);
                return mimeType;
            }
        }

        // 如果都不支持，返回空字符串让浏览器自己选择
        console.warn('没有找到支持的音频格式，使用浏览器默认格式');
        return '';
    }

    // 获取录音时长（毫秒）
    getRecordingDuration() {
        if (this.mediaRecorder && this.isRecording) {
            return Date.now() - this.recordingStartTime;
        }
        return 0;
    }

    // 检查浏览器是否支持录音
    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia && 
                 window.MediaRecorder);
    }

    // 检查麦克风权限
    static async checkMicrophonePermission() {
        try {
            const result = await navigator.permissions.query({ name: 'microphone' });
            return result.state; // 'granted', 'denied', 'prompt'
        } catch (error) {
            console.warn('无法检查麦克风权限:', error);
            return 'unknown';
        }
    }

    // 将Blob转换为Base64（用于API调用）
    static blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1]; // 移除data:audio/...;base64,前缀
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // 将Blob转换为ArrayBuffer（用于某些API）
    static blobToArrayBuffer(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }

    // 创建音频URL用于播放
    static createAudioURL(blob) {
        return URL.createObjectURL(blob);
    }

    // 下载录音文件
    static downloadAudio(blob, filename = 'recording') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${this.getFileExtension(blob.type)}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 根据MIME类型获取文件扩展名
    static getFileExtension(mimeType) {
        const extensions = {
            'audio/webm': 'webm',
            'audio/mp4': 'm4a',
            'audio/wav': 'wav',
            'audio/mpeg': 'mp3'
        };
        return extensions[mimeType] || 'audio';
    }

    // 获取音频时长（需要创建audio元素）
    static getAudioDuration(blob) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            const url = URL.createObjectURL(blob);
            
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(url);
                resolve(audio.duration);
            };
            
            audio.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('无法获取音频时长'));
            };
            
            audio.src = url;
        });
    }

    // 音频格式转换（简单的重新封装）
    static async convertAudio(blob, targetMimeType) {
        // 注意：这只是重新封装，不是真正的格式转换
        // 真正的格式转换需要使用Web Audio API或服务器端处理
        if (MediaRecorder.isTypeSupported(targetMimeType)) {
            const arrayBuffer = await this.blobToArrayBuffer(blob);
            return new Blob([arrayBuffer], { type: targetMimeType });
        } else {
            throw new Error(`不支持的目标格式: ${targetMimeType}`);
        }
    }
}

// 初始化全局录音器实例
window.audioRecorder = new AudioRecorder();

// 检查浏览器支持
if (!AudioRecorder.isSupported()) {
    console.error('当前浏览器不支持录音功能');
    alert('当前浏览器不支持录音功能，请使用Chrome、Firefox或Safari等现代浏览器');
}

// 检查麦克风权限
AudioRecorder.checkMicrophonePermission().then(permission => {
    console.log('麦克风权限状态:', permission);
    if (permission === 'denied') {
        console.warn('麦克风权限被拒绝，用户需要手动开启');
    }
});
