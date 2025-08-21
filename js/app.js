// 主应用逻辑
// IndexedDB helpers for audio blob persistence
const DB_NAME = 'voice_notes';
const DB_VERSION = 1;
const STORE_NAME = 'audioBlobs';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveAudioBlob(id, blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE_NAME).put({ id, blob });
    });
}

async function getAudioBlob(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        tx.onerror = () => reject(tx.error);
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    });
}
async function clearAllAudioBlobs() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE_NAME).clear();
    });
}


class VoiceNoteApp {
    constructor() {
        this.currentPage = 'home';
        this.currentRecording = null;
        this.recordings = JSON.parse(localStorage.getItem('recordings') || '[]');
        this.isRecording = false;

        console.log('🔍 VoiceNoteApp 构造函数，加载的录音数据:', this.recordings);
        console.log('🔍 录音数量:', this.recordings.length);
        if (this.recordings.length > 0) {
            console.log('🔍 第一个录音的结构:', this.recordings[0]);
        }

        this.init();
    }

    init() {
        this.checkDOMElements();
        this.bindEvents();
        this.loadRecentRecords();
        this.updateCollectionCount();

        // 检查并重试缓存的上传文件
        this.retryPendingUploads();
    }

    checkDOMElements() {
        const requiredElements = [
            'recordingConfirmModal',
            'saveRecording',
            'discardRecording',
            'previewAudio',
            'confirmDuration'
        ];

        console.log('🔍 检查DOM元素...');
        for (const elementId of requiredElements) {
            const element = document.getElementById(elementId);
            if (element) {
                console.log(`✅ ${elementId}: 找到`);
            } else {
                console.error(`❌ ${elementId}: 未找到`);
            }
        }
    }

    bindEvents() {
        // 录音按钮
        document.getElementById('recordBtn').addEventListener('click', () => {
            this.toggleRecording();
        });

        // 返回按钮
        document.getElementById('backBtn').addEventListener('click', () => {
            this.showPage('home');
        });

        // 功能卡片
        document.getElementById('myCollectionCard').addEventListener('click', () => {
            this.showMyCollection();
        });

        document.getElementById('hotPicksCard').addEventListener('click', () => {
            this.showHotPicks();
        });

        // 播放控制 - 黑胶唱片中心按钮
        document.getElementById('vinylPlayBtn').addEventListener('click', () => {
            this.togglePlayback();
        });

        // Tab切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.currentTarget; // 始终是按钮本身
                this.switchTab(btnEl.dataset.tab);
            });
        });
        // 初始化 tab 指示条位置（只绑定一次）
        this.updateTabIndicator();
        window.addEventListener('resize', () => this.updateTabIndicator());

        // 录音确认弹窗
        const saveBtn = document.getElementById('saveRecording');
        const discardBtn = document.getElementById('discardRecording');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.confirmSaveRecording();
            });
        } else {
            console.warn('⚠️ 找不到保存录音按钮 #saveRecording');
        }

        if (discardBtn) {
            discardBtn.addEventListener('click', () => {
                this.discardRecording();
            });
        } else {
            console.warn('⚠️ 找不到丢弃录音按钮 #discardRecording');
        }
    }

    async toggleRecording() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            await this.stopRecording();
        }
    }

    async startRecording() {
        try {
            this.isRecording = true;
            const recordBtn = document.getElementById('recordBtn');
            const recordingText = document.getElementById('recordingText');

            recordBtn.classList.add('recording');
            recordingText.textContent = '正在录音...';

            // 启动录音器
            await window.audioRecorder.startRecording();

            // 开始计时
            this.startTimer();

            // 显示脉冲动画
            document.querySelector('.recording-visualizer').style.display = 'block';

        } catch (error) {
            console.error('录音启动失败:', error);
            this.showError('录音启动失败，请检查麦克风权限');
            this.isRecording = false;
        }
    }

    async stopRecording() {
        try {
            this.isRecording = false;
            const recordBtn = document.getElementById('recordBtn');
            const recordingText = document.getElementById('recordingText');

            recordBtn.classList.remove('recording');
            recordingText.textContent = '录音完成';

            // 停止录音
            const audioBlob = await window.audioRecorder.stopRecording();

            // 停止计时
            this.stopTimer();

            // 隐藏脉冲动画
            document.querySelector('.recording-visualizer').style.display = 'none';

            // 显示确认界面，用户选择保存或丢弃
            console.log('🎤 录音完成，显示确认弹窗');
            this.showRecordingConfirmation(audioBlob);

        } catch (error) {
            console.error('录音处理失败:', error);
            this.showError('录音处理失败');
        }
    }

    async processRecording(audioBlob) {
        this.showLoading('正在上传录音...');

        try {
            // 创建录音记录
            const recording = {
                id: Date.now().toString(),
                title: `录音 ${new Date().toLocaleString()}`,
                blob: audioBlob,
                duration: this.recordingDuration,
                createdAt: new Date().toISOString(),
                status: 'processing'
            };

            // 将音频持久化到 IndexedDB
            try { await saveAudioBlob(recording.id, audioBlob); } catch (e) { console.warn('保存音频到IndexedDB失败', e); }

            // 保存到本地存储
            this.recordings.unshift(recording);
            this.saveRecordings();

            // 开始处理流程
            await this.processAudioPipeline(recording);

        } catch (error) {
            console.error('录音处理失败:', error);
            this.showError('录音处理失败');
        } finally {
            this.hideLoading();
            document.getElementById('recordingText').textContent = '点击开始录音';
            document.getElementById('recordingTime').textContent = '00:00';
        }
    }

    async processAudioPipeline(recording) {
        const demo = (typeof window.getRandomDemoData === 'function') ? window.getRandomDemoData() : null;
        try {
            // 1. ASR转录
            this.showLoading('正在转录语音...');
            const transcription = await window.apiService.transcribeAudio(recording.blob);
            recording.transcription = transcription;

            // 2. LLM分析（失败不阻断流程，回退到演示数据）
            this.showLoading('正在分析内容...');
            let analysis = null;
            try {
                analysis = await window.apiService.analyzeText(transcription.text);
                console.log('✅ LLM分析成功:', analysis);
            } catch (e) {
                console.warn('❌ LLM分析失败，尝试使用模拟数据继续:', e);
                analysis = demo?.analysis || null;
                if (!analysis) {
                    console.log('🔄 演示数据不可用，使用默认分析数据');
                    analysis = await window.apiService.mockLLMResponse();
                }
                console.log('🔄 使用fallback分析数据:', analysis);
            }
            recording.analysis = analysis;

            // 3. 更新状态
            recording.status = 'completed';
            this.saveRecordings();

            // 4. 跳转到播放页
            this.showRecordingDetail(recording);

        } catch (error) {
            console.error('处理流程失败:', error);
            // 即便流程失败，也尽量展示已有的转写文本
            recording.status = recording.transcription?.text ? 'completed' : 'failed';
            this.saveRecordings();
            this.showRecordingDetail(recording);
            if (!recording.transcription?.text) {
                this.showError('处理失败，请重试');
            }
        }
    }

    showRecordingDetail(recording) {
        this.currentRecording = recording;

        console.log('🔍 showRecordingDetail 调用，录音对象:', recording);
        console.log('🔍 录音ID:', recording.id);
        console.log('🔍 录音转录数据:', recording.transcription);
        console.log('🔍 录音分析数据:', recording.analysis);

        // 更新播放页内容
        const transcriptElement = document.getElementById('transcriptContent');
        const transcriptText = recording.transcription?.text || '转录内容加载中...';
        console.log('🔍 转录文本:', transcriptText);
        if (transcriptElement) {
            transcriptElement.textContent = transcriptText;
        }

        // 显示分析结果，优先使用录音自身的分析数据
        console.log('分析数据检查:', {
            'recording.analysis': recording.analysis,
            'recording.analysis.customerProfile': recording.analysis?.customerProfile,
            'recording对象': recording
        });

        // 如果录音没有分析数据，使用随机演示数据作为回填
        let analysisData = recording.analysis;
        if (!analysisData && typeof window.getRandomDemoData === 'function') {
            const demo = window.getRandomDemoData();
            analysisData = demo?.analysis;
            console.log('使用演示数据回填:', demo?.analysis);
        }

        console.log('准备标准化的分析数据:', analysisData);
        console.log('分析数据的customerProfile:', analysisData?.customerProfile);
        const normalizedAnalysis = this.normalizeAnalysis(analysisData);
        console.log('标准化后的分析:', normalizedAnalysis);
        console.log('标准化后的customerProfile:', normalizedAnalysis?.customerProfile);
        this.displayAnalysis(normalizedAnalysis);


        // 启用“导入台账”按钮（分析完成后）
        // 旧的按钮设置代码（已移到 setupImportButton 方法中）
        /*
        const importBtn = document.getElementById('importBitableBtn');
        if (importBtn) {
            console.log('导入按钮状态检查:', {
                normalizedAnalysis: !!normalizedAnalysis,
                recording: !!recording,
                analysis: !!recording?.analysis,
                demo: !!demo?.analysis
            });

            // 如果有分析数据（真实的或演示的），就启用按钮
            const hasAnalysisData = normalizedAnalysis || demo?.analysis || recording?.analysis;
            importBtn.disabled = !hasAnalysisData;
            importBtn.title = hasAnalysisData ? '将本条记录导入飞书多维表格' : '分析完成后可导入';

            importBtn.onclick = async () => {
                // 检查是否有任何形式的分析数据
                const currentAnalysis = this.currentRecording?.analysis || demo?.analysis;
                if (!currentAnalysis) {
                    window.showStatus && window.showStatus('分析未完成，无法导入', 'warning');
                    return;
                }

                // 禁用按钮，防止重复点击
                importBtn.disabled = true;
                const originalText = importBtn.innerHTML;
                importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导入中...';

                try {
                    console.log('🚀 开始导入到飞书:', currentAnalysis);
                    window.showStatus && window.showStatus('正在导入到飞书多维表格...', 'info');

                    // 准备录音数据
                    const recordingData = {
                        analysis: currentAnalysis,
                        transcription: this.currentRecording?.transcription || demo?.transcription || { text: '无转录文本' },
                        createdAt: this.currentRecording?.createdAt || demo?.createdAt || new Date().toISOString(),
                        duration: this.currentRecording?.duration || demo?.duration || 0
                    };

                    // 调用飞书API
                    const result = await window.apiService.syncToFeishu(recordingData);

                    if (result.success) {
                        window.showStatus && window.showStatus('✅ 导入成功！数据已同步到飞书多维表格', 'success');
                        console.log('✅ 飞书导入成功:', result);
                    } else {
                        window.showStatus && window.showStatus(`❌ 导入失败: ${result.message}`, 'error');
                        console.error('❌ 飞书导入失败:', result);
                    }

                } catch (error) {
                    console.error('❌ 导入过程出错:', error);
                    window.showStatus && window.showStatus(`❌ 导入出错: ${error.message}`, 'error');
                } finally {
                    // 恢复按钮状态
                    importBtn.disabled = false;
                    importBtn.innerHTML = originalText;
                }
            };
        }
        */

        // 初始化音频播放器
        this.initAudioPlayer(recording);

        // 切换到播放页
        this.showPage('playback');

        // 确保默认显示转录文本标签页
        this.switchTab('transcript');

        // 延迟设置按钮状态，确保页面已完全渲染
        setTimeout(() => {
            this.setupImportButton(recording, null, normalizedAnalysis);
        }, 100);

        // 同时也立即尝试设置一次（如果按钮已存在）
        this.setupImportButton(recording, null, normalizedAnalysis);
    }

    initAudioPlayer(recording) {
        const audioPlayer = document.getElementById('mainAudioPlayer');
        const totalTimeEl = document.getElementById('totalTime');
        const currentTimeEl = document.getElementById('currentTime');
        const progressFill = document.getElementById('progressFill');

        const setSrcFromBlob = (blob) => {
            if (!blob) return;
            const audioUrl = URL.createObjectURL(blob);
            audioPlayer.src = audioUrl;
            audioPlayer.addEventListener('loadedmetadata', () => {
                if (isFinite(audioPlayer.duration)) {
                    totalTimeEl.textContent = this.formatTime(audioPlayer.duration);
                } else if (recording.duration) {
                    totalTimeEl.textContent = this.formatTime(recording.duration / 1000);
                }
            }, { once: true });
            audioPlayer.addEventListener('durationchange', () => {
                if (isFinite(audioPlayer.duration)) {
                    totalTimeEl.textContent = this.formatTime(audioPlayer.duration);
                }
            });
        };

        if (recording.blob) {
            setSrcFromBlob(recording.blob);
        } else {
            // 从IndexedDB补回blob
            getAudioBlob(recording.id).then((blob) => {
                if (blob) {
                    recording.blob = blob; // 缓存到对象，后续可直接使用
                    setSrcFromBlob(blob);
                }
            }).catch(err => console.warn('读取IndexedDB音频失败', err));
        }

        // 重置UI状态
        if (currentTimeEl) currentTimeEl.textContent = '00:00';
        if (totalTimeEl && recording.duration) {
            totalTimeEl.textContent = this.formatTime(recording.duration / 1000);
        }
        if (progressFill) progressFill.style.width = '0%';

        // 重置播放状态
        this.stopPlayback();
    }

    displayAnalysis(analysis) {
        // 更新智能总结tab
        const summaryContainer = document.getElementById('summaryContent');
        const insightsContainer = document.getElementById('insightsContent');

        if (!analysis) {
            if (summaryContainer) summaryContainer.innerHTML = '<p>分析结果加载中...</p>';
            if (insightsContainer) insightsContainer.innerHTML = '<p>分析结果加载中...</p>';
            return;
        }

        // 更新智能总结内容
        if (summaryContainer) {
            summaryContainer.innerHTML = `
                <div class="analysis-item">
                    <div class="analysis-label">业务类别</div>
                    <div class="analysis-value">${analysis.businessType || '未分析'}</div>
                </div>
                <div class="analysis-item">
                    <div class="analysis-label">客户信息</div>
                    <div class="analysis-value">
                        姓名: ${analysis.customerInfo?.name || '未提及'}<br>
                        客户号: ${analysis.customerInfo?.customerId || '未提及'}
                    </div>
                </div>
                <div class="analysis-item">
                    <div class="analysis-label">跟进规划</div>
                    <div class="analysis-value">${analysis.followUpPlan || '待制定'}</div>
                </div>
            `;
        }

        // 更新深度洞察内容
        if (insightsContainer) {
            insightsContainer.innerHTML = `
                <div class="analysis-item">
                    <div class="analysis-label">客户画像</div>
                    <div class="analysis-value">
                        <div class="customer-tags">
                            ${analysis.customerProfile ? analysis.customerProfile.map(tag => `<span class="tag">${tag}</span>`).join('') : '<span class="tag">待分析</span>'}
                        </div>
                    </div>
                </div>
                ${analysis.optionalFields?.demandStimulation ? `
                    <div class="analysis-item">
                        <div class="analysis-label">需求激发</div>
                        <div class="analysis-value">${analysis.optionalFields.demandStimulation}</div>
                    </div>
                ` : ''}
                ${analysis.optionalFields?.objectionHandling ? `
                    <div class="analysis-item">
                        <div class="analysis-label">异议处理</div>
                        <div class="analysis-value">${analysis.optionalFields.objectionHandling}</div>
                    </div>
                ` : ''}
                ${analysis.optionalFields?.customerTouchPoint ? `
                    <div class="analysis-item">
                        <div class="analysis-label">打动客户的点</div>
                        <div class="analysis-value">${analysis.optionalFields.customerTouchPoint}</div>
                    </div>
                ` : ''}
                ${analysis.optionalFields?.failureReview ? `
                    <div class="analysis-item">
                        <div class="analysis-label">失败复盘</div>
                        <div class="analysis-value">${analysis.optionalFields.failureReview}</div>
                    </div>
                ` : ''}
                ${analysis.optionalFields?.extendedThinking ? `
                    <div class="analysis-item">
                        <div class="analysis-label">延伸思考</div>
                        <div class="analysis-value">${analysis.optionalFields.extendedThinking}</div>
                    </div>
                ` : ''}
            `;
        }
    }
    // 统一分析数据结构，确保 customerProfile 一定是数组
    normalizeAnalysis(analysis) {
        if (!analysis) return null;
        const copy = JSON.parse(JSON.stringify(analysis));
        const cp = copy.customerProfile;
        if (Array.isArray(cp)) {
            // ok
        } else if (cp && typeof cp === 'object') {
            // 对象 -> 取值数组
            copy.customerProfile = Object.values(cp).filter(Boolean);
        } else if (typeof cp === 'string') {
            // 逗号/空格分隔字符串 -> 数组
            copy.customerProfile = cp.split(/[,\s]+/).filter(Boolean);
        } else if (!cp) {
            copy.customerProfile = [];
        }
        // optionalFields 保护
        copy.optionalFields = copy.optionalFields || {};
        return copy;
    }

    // 设置导入按钮状态（延迟调用，确保DOM已渲染）
    setupImportButton(recording, demo, normalizedAnalysis) {
        const importBtn = document.getElementById('importBitableBtn');
        if (importBtn) {
            console.log('导入按钮状态检查 (延迟):', {
                normalizedAnalysis: !!normalizedAnalysis,
                'normalizedAnalysis值': normalizedAnalysis,
                recording: !!recording,
                analysis: !!recording?.analysis,
                'recording.analysis值': recording?.analysis,
                demo: !!demo?.analysis,
                'demo.analysis值': demo?.analysis
            });

            // 如果有分析数据（真实的或演示的），就启用按钮
            const hasAnalysisData = normalizedAnalysis || demo?.analysis || recording?.analysis;
            console.log('按钮启用条件检查:', {
                hasAnalysisData,
                '按钮当前disabled': importBtn.disabled,
                '即将设置disabled为': !hasAnalysisData
            });

            importBtn.disabled = !hasAnalysisData;
            importBtn.title = hasAnalysisData ? '将本条记录导入飞书多维表格' : '分析完成后可导入';

            console.log('按钮状态设置完成:', {
                '按钮disabled': importBtn.disabled,
                '按钮title': importBtn.title
            });

            importBtn.onclick = async () => {
                // 检查是否有任何形式的分析数据
                const currentAnalysis = this.currentRecording?.analysis || demo?.analysis;
                if (!currentAnalysis) {
                    window.showStatus && window.showStatus('分析未完成，无法导入', 'warning');
                    return;
                }

                // 禁用按钮，防止重复点击
                importBtn.disabled = true;
                const originalText = importBtn.innerHTML;
                importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 导入中...';

                try {
                    console.log('🚀 开始导入到飞书:', currentAnalysis);
                    window.showStatus && window.showStatus('正在导入到飞书多维表格...', 'info');

                    // 准备录音数据
                    const recordingData = {
                        analysis: currentAnalysis,
                        transcription: this.currentRecording?.transcription || demo?.transcription || { text: '无转录文本' },
                        createdAt: this.currentRecording?.createdAt || demo?.createdAt || new Date().toISOString(),
                        duration: this.currentRecording?.duration || demo?.duration || 0
                    };

                    // 调用飞书API
                    const result = await window.apiService.syncToFeishu(recordingData);

                    if (result.success) {
                        window.showStatus && window.showStatus('✅ 导入成功！数据已同步到飞书多维表格', 'success');
                        console.log('✅ 飞书导入成功:', result);
                    } else {
                        window.showStatus && window.showStatus(`❌ 导入失败: ${result.message}`, 'error');
                        console.error('❌ 飞书导入失败:', result);
                    }

                } catch (error) {
                    console.error('❌ 导入过程出错:', error);
                    window.showStatus && window.showStatus(`❌ 导入出错: ${error.message}`, 'error');
                } finally {
                    // 恢复按钮状态
                    importBtn.disabled = false;
                    importBtn.innerHTML = originalText;
                }
            };
        } else {
            console.warn('导入按钮未找到，可能页面还未完全渲染');
        }
    }

    showPage(pageName) {
        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 显示目标页面
        document.getElementById(pageName + 'Page').classList.add('active');
        this.currentPage = pageName;
    }

    switchTab(tabName) {
        // 切换tab按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 切换内容面板
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        const targetPanel = document.getElementById(tabName + 'Tab');
        if (targetPanel) targetPanel.classList.add('active');

        // 更新滑动指示条
        this.updateTabIndicator();
    }


    /**
     * 根据激活的 .tab-btn 定位滑动指示条
     */
    updateTabIndicator() {
        const tabsEl = document.querySelector('.analysis-results .tabs');
        const indicator = document.querySelector('.analysis-results .tab-indicator');
        const activeBtn = document.querySelector('.analysis-results .tab-btn.active');
        if (!tabsEl || !indicator || !activeBtn) return;

        const tabsRect = tabsEl.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        const left = btnRect.left - tabsRect.left;

        // 获取文字实际宽度，让指示条与文字对齐
        const textEl = activeBtn.querySelector('.tab-label');
        const textWidth = textEl ? textEl.offsetWidth : btnRect.width;
        const indicatorWidth = Math.max(textWidth - 4, 20); // 稍微短于文字宽度
        const x = left + (btnRect.width - indicatorWidth) / 2;

        indicator.style.width = indicatorWidth + 'px';
        indicator.style.transform = `translateX(${x}px)`;
    }

    togglePlayback() {
        const btn = document.getElementById('vinylPlayBtn');
        const vinyl = document.getElementById('vinylRecord');
        const audioPlayer = document.getElementById('mainAudioPlayer');



        if (!btn.classList.contains('playing')) {
            // 开始播放
            if (this.currentRecording) {
                const ensureSrc = async () => {
                    if (this.currentRecording.blob) {
                        if (!audioPlayer.src) {
                            audioPlayer.src = URL.createObjectURL(this.currentRecording.blob);
                        }
                        return true;
                    }
                    const blob = await getAudioBlob(this.currentRecording.id);
                    if (blob) {
                        this.currentRecording.blob = blob;
                        audioPlayer.src = URL.createObjectURL(blob);
                        return true;
                    }
                    return false;
                };

                ensureSrc().then((ok) => {
                    if (!ok) return;
                    audioPlayer.play().then(() => {
                        btn.classList.add('playing');
                        vinyl.classList.add('spinning');
                        this.startProgressUpdate();
                    }).catch(err => {
                        console.error('Failed to play audio:', err);
                    });
                });
            }
        } else {
            // 暂停播放
            audioPlayer.pause();
            btn.classList.remove('playing');
            vinyl.classList.remove('spinning');
            this.stopProgressUpdate();
        }
    }

    seekTo(event) {
        const progressBar = event.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;

        // 更新进度条（拇指跟随填充层，无需单独设置left）
        document.getElementById('progressFill').style.width = `${percent * 100}%`;
    }

    startTimer() {
        this.recordingStartTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;

            document.getElementById('recordingTime').textContent =
                `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;

            this.recordingDuration = elapsed;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    loadRecentRecords() {
        const container = document.getElementById('recordsList');
        const recentRecords = this.recordings.slice(0, 5);

        if (recentRecords.length === 0) {
            container.classList.remove('has-records');
            container.innerHTML = '';
            return;
        }

        container.classList.add('has-records');
        container.innerHTML = recentRecords.map(record => {
            const customerName = record.analysis?.customerInfo?.name || '未识别客户';
            const followUpPlan = record.analysis?.followUpPlan || '待制定计划';
            const businessType = record.analysis?.businessType || '处理中';
            const recordTime = new Date(record.createdAt).toLocaleString();

            // 限制第一个字段的长度，最大20个字符
            const maxLength = 20;
            const firstField = `${customerName} - ${followUpPlan}`;
            const truncatedFirstField = firstField.length > maxLength
                ? firstField.substring(0, maxLength) + '...'
                : firstField;

            return `
                <div class="record-item" onclick="app.showRecordingDetail(app.recordings.find(r => r.id === '${record.id}'))">
                    <div class="record-meta">
                        <div class="record-title">${truncatedFirstField}</div>
                        <div class="record-time">${recordTime}</div>
                    </div>
                    <div class="record-type">${businessType}</div>
                </div>
            `;
        }).join('');
    }

    updateCollectionCount() {
        document.getElementById('collectionCount').textContent = this.recordings.length;
    }

    saveRecordings() {
        // 注意：实际应用中不应该将Blob存储在localStorage中
        // 这里仅用于演示，实际应该上传到服务器
        const recordingsToSave = this.recordings.map(r => ({
            ...r,
            blob: null // 移除blob以避免localStorage限制
        }));
        localStorage.setItem('recordings', JSON.stringify(recordingsToSave));
        this.updateCollectionCount();
        this.loadRecentRecords();
    }

    showMyCollection() {
        alert('我的收藏功能开发中...');
    }

    showHotPicks() {
        alert('热门精选功能开发中...');
    }

    showLoading(text) {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        loadingText.textContent = text;
        overlay.classList.add('active');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }

    showRecordingConfirmation(audioBlob) {
        this.pendingRecording = {
            blob: audioBlob,
            duration: this.recordingDuration
        };

        // 先显示弹窗
        let modal = document.getElementById('recordingConfirmModal');
        if (!modal) {
            // 尝试使用querySelector作为备选
            modal = document.querySelector('#recordingConfirmModal');
        }
        if (!modal) {
            console.error('❌ 找不到录音确认模态框，直接处理录音');
            console.log('🔍 DOM状态:', document.readyState);
            console.log('🔍 所有模态框:', document.querySelectorAll('.modal-overlay'));
            // 如果找不到模态框，直接处理录音
            this.processRecording(audioBlob);
            return;
        }

        console.log('✅ 找到录音确认模态框，显示确认界面');
        modal.classList.add('active');

        // 等待DOM更新后再设置内容
        setTimeout(() => {
            try {
                // 创建音频URL用于预览
                const audioUrl = URL.createObjectURL(audioBlob);
                const previewAudio = document.getElementById('previewAudio');

                if (previewAudio) {
                    previewAudio.src = audioUrl;
                    console.log('✅ 音频预览设置成功');
                } else {
                    console.warn('❌ 找不到预览音频元素 #previewAudio');
                }

                // 显示录音时长
                const minutes = Math.floor(this.recordingDuration / 60000);
                const seconds = Math.floor((this.recordingDuration % 60000) / 1000);
                const durationElement = document.getElementById('confirmDuration');

                if (durationElement) {
                    durationElement.textContent =
                        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    console.log('✅ 录音时长设置成功:', durationElement.textContent);
                } else {
                    console.warn('❌ 找不到时长显示元素 #confirmDuration');
                }
            } catch (error) {
                console.error('设置录音确认界面失败:', error);
            }
        }, 100);
    }

    confirmSaveRecording() {
        // 隐藏弹窗
        const modal = document.getElementById('recordingConfirmModal');
        if (modal) {
            modal.classList.remove('active');
        }

        // 处理录音
        if (this.pendingRecording) {
            this.processRecording(this.pendingRecording.blob);
        }

        // 清理
        this.pendingRecording = null;
    }

    discardRecording() {
        // 隐藏弹窗
        const modal = document.getElementById('recordingConfirmModal');
        if (modal) {
            modal.classList.remove('active');
        }

        // 清理音频URL
        const previewAudio = document.getElementById('previewAudio');
        if (previewAudio.src) {
            URL.revokeObjectURL(previewAudio.src);
            previewAudio.src = '';
        }

        // 重置UI
        document.getElementById('recordingText').textContent = '点击开始录音';
        document.getElementById('recordingTime').textContent = '00:00';

        // 清理
        this.pendingRecording = null;
    }

    startProgressUpdate() {
        const audioPlayer = document.getElementById('mainAudioPlayer');
        const progressFill = document.getElementById('progressFill');
        const currentTimeEl = document.getElementById('currentTime');
        const totalTimeEl = document.getElementById('totalTime');



        this.progressInterval = setInterval(() => {
            // 更新当前时间显示
            if (currentTimeEl) {
                currentTimeEl.textContent = this.formatTime(audioPlayer.currentTime);
            }

            // 检查duration是否有效
            if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
                const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;

                if (progressFill) {
                    progressFill.style.width = progress + '%';
                }

                if (totalTimeEl) {
                    totalTimeEl.textContent = this.formatTime(audioPlayer.duration);
                }
            } else {
                // 如果duration不可用，使用录音时长作为备选
                if (this.currentRecording && this.currentRecording.duration) {
                    const estimatedDuration = this.currentRecording.duration / 1000; // 转换为秒
                    const progress = (audioPlayer.currentTime / estimatedDuration) * 100;

                    if (progressFill) {
                        progressFill.style.width = Math.min(progress, 100) + '%';
                    }

                    if (totalTimeEl) {
                        totalTimeEl.textContent = this.formatTime(estimatedDuration);
                    }
                }
            }
        }, 100);

        // 监听播放结束
        audioPlayer.addEventListener('ended', () => {
            this.stopPlayback();
        });

        // 添加进度条点击和拖拽功能
        this.setupProgressBarInteraction();
    }

    stopProgressUpdate() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    setupProgressBarInteraction() {
        const progressBar = document.getElementById('progressBar');
        const progressThumb = document.getElementById('progressThumb');
        const audioPlayer = document.getElementById('mainAudioPlayer');

        if (!progressBar || !progressThumb || !audioPlayer) return;

        let isDragging = false;

        // 点击进度条跳转
        progressBar.addEventListener('click', (e) => {
            if (isDragging) return;

            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = clickX / rect.width;

            this.seekToPercentage(percentage);
        });

        // 拖拽开始
        progressThumb.addEventListener('mousedown', (e) => {
            isDragging = true;
            e.preventDefault();

            const handleMouseMove = (e) => {
                if (!isDragging) return;

                const rect = progressBar.getBoundingClientRect();
                const dragX = e.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, dragX / rect.width));

                this.seekToPercentage(percentage);
            };

            const handleMouseUp = () => {
                isDragging = false;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        // 触摸设备支持
        progressThumb.addEventListener('touchstart', (e) => {
            isDragging = true;
            e.preventDefault();

            const handleTouchMove = (e) => {
                if (!isDragging) return;

                const rect = progressBar.getBoundingClientRect();
                const touch = e.touches[0];
                const dragX = touch.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, dragX / rect.width));

                this.seekToPercentage(percentage);
            };

            const handleTouchEnd = () => {
                isDragging = false;
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
            };

            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
        });
    }

    seekToPercentage(percentage) {
        const audioPlayer = document.getElementById('mainAudioPlayer');

        if (audioPlayer.duration && isFinite(audioPlayer.duration)) {
            audioPlayer.currentTime = audioPlayer.duration * percentage;
        } else if (this.currentRecording && this.currentRecording.duration) {
            const estimatedDuration = this.currentRecording.duration / 1000;
            audioPlayer.currentTime = estimatedDuration * percentage;
        }
    }

    stopPlayback() {
        const btn = document.getElementById('vinylPlayBtn');
        const vinyl = document.getElementById('vinylRecord');

        btn.classList.remove('playing');
        vinyl.classList.remove('spinning');
        this.stopProgressUpdate();

        // 重置进度条
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('currentTime').textContent = '00:00';
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    seekToPosition(e) {
        const audioPlayer = document.getElementById('mainAudioPlayer');
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;

        if (audioPlayer.duration) {
            const newTime = percentage * audioPlayer.duration;
            audioPlayer.currentTime = newTime;

            // 立即更新进度条显示
            const progressFill = document.getElementById('progressFill');
            progressFill.style.width = (percentage * 100) + '%';

            // 更新时间显示
            document.getElementById('currentTime').textContent = this.formatTime(newTime);
        }
    }

    showError(message) {
        if (window.showStatus) {
            window.showStatus(message, 'error');
        } else {
            alert(message);
        }
    }

    /**
     * 重试待上传的缓存文件
     */
    async retryPendingUploads() {
        try {
            if (window.uploadService && typeof window.uploadService.retryFromCache === 'function') {
                const results = await window.uploadService.retryFromCache();

                if (results.length > 0) {
                    const successCount = results.filter(r => r.success).length;
                    const failCount = results.length - successCount;

                    if (successCount > 0) {
                        console.log(`✅ 成功重试上传 ${successCount} 个缓存文件`);
                        if (window.showStatus) {
                            window.showStatus(`✅ 成功重试上传 ${successCount} 个缓存文件`, 'success');
                        }
                    }

                    if (failCount > 0) {
                        console.warn(`⚠️ ${failCount} 个缓存文件重试失败`);
                    }
                }
            }
        } catch (error) {
            console.error('重试缓存上传失败:', error);
        }
    }
}

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new VoiceNoteApp();

    // 如果没有录音数据，使用完整的演示数据
    if (app.recordings.length === 0) {
        // 确保演示数据已加载
        if (typeof window.demoData !== 'undefined' && window.demoData.recordings) {
            console.log('🔍 使用完整演示数据:', window.demoData.recordings);
            app.recordings = [...window.demoData.recordings];
        } else {
            console.warn('⚠️ 演示数据未加载，使用简化数据');
            // 回退到简化数据
            app.recordings = [
                {
                    id: 'demo1',
                    title: '张总面访记录',
                    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                    analysis: {
                        businessType: '面访跟踪',
                        customerInfo: { name: '张总' },
                        followUpPlan: '下周准备详细保障方案，重点突出分期缴费的灵活性'
                    }
                }
            ];
        }
        app.loadRecentRecords();
        app.updateCollectionCount();
    }
});
