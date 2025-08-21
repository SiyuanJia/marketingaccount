// UI交互增强功能
class UIEnhancer {
    constructor() {
        this.init();
    }

    init() {
        this.addRippleEffects();
        this.addScrollAnimations();
        this.addKeyboardShortcuts();
        this.addTouchGestures();
        this.addVisualFeedback();
    }

    // 添加波纹点击效果
    addRippleEffects() {
        const rippleElements = document.querySelectorAll('.feature-card, .control-btn, .record-button');

        rippleElements.forEach(element => {
            element.addEventListener('click', (e) => {
                this.createRipple(e, element);
            });
        });
    }

    createRipple(event, element) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
            z-index: 1000;
        `;

        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    // 添加滚动动画
    addScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                }
            });
        }, observerOptions);

        // 观察需要动画的元素
        const animatedElements = document.querySelectorAll('.feature-card, .record-item, .analysis-item');
        animatedElements.forEach(el => observer.observe(el));
    }

    // 添加键盘快捷键
    addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 空格键：开始/停止录音
            if (e.code === 'Space' && !e.target.matches('input, textarea')) {
                e.preventDefault();
                if (window.app) {
                    window.app.toggleRecording();
                }
            }

            // ESC键：返回主页
            if (e.code === 'Escape') {
                if (window.app && window.app.currentPage === 'play') {
                    window.app.showPage('home');
                }
            }

            // 左右箭头：切换Tab
            if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
                if (window.app && window.app.currentPage === 'play') {
                    const tabs = document.querySelectorAll('.tab-btn');
                    const activeTab = document.querySelector('.tab-btn.active');
                    const currentIndex = Array.from(tabs).indexOf(activeTab);

                    let newIndex;
                    if (e.code === 'ArrowLeft') {
                        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
                    } else {
                        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
                    }

                    tabs[newIndex].click();
                }
            }
        });
    }

    // 添加触摸手势
    addTouchGestures() {
        let startY = 0;
        let startX = 0;
        let isScrolling = false;

        // 播放页面的滑动手势
        const playPage = document.getElementById('playPage');

        playPage.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
            isScrolling = false;
        });

        playPage.addEventListener('touchmove', (e) => {
            if (!isScrolling) {
                const currentY = e.touches[0].clientY;
                const currentX = e.touches[0].clientX;
                const diffY = Math.abs(currentY - startY);
                const diffX = Math.abs(currentX - startX);

                if (diffY > diffX && diffY > 10) {
                    isScrolling = true;
                }
            }
        });

        playPage.addEventListener('touchend', (e) => {
            if (!isScrolling) {
                const endY = e.changedTouches[0].clientY;
                const endX = e.changedTouches[0].clientX;
                const diffY = startY - endY;
                const diffX = startX - endX;

                // 向右滑动返回
                if (diffX < -50 && Math.abs(diffY) < 100) {
                    if (window.app) {
                        window.app.showPage('home');
                    }
                }

                // 双击播放/暂停
                if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
                    const now = Date.now();
                    if (this.lastTap && (now - this.lastTap) < 300) {
                        if (window.app) {
                            window.app.togglePlayback();
                        }
                    }
                    this.lastTap = now;
                }
            }
        });
    }

    // 添加视觉反馈
    addVisualFeedback() {
        // 录音状态视觉反馈
        this.addRecordingVisualizer();

        // 加载状态反馈
        this.addLoadingStates();

        // 成功/错误状态反馈
        this.addStatusFeedback();
    }

    addRecordingVisualizer() {
        // 创建音频可视化器
        const visualizer = document.querySelector('.recording-visualizer');

        // 添加音频波形动画
        const createWaveBar = () => {
            const bar = document.createElement('div');
            bar.className = 'wave-bar';
            return bar;
        };

        // 在录音时显示波形
        const showWaveform = () => {
            const waveContainer = document.createElement('div');
            waveContainer.className = 'audio-wave';

            for (let i = 0; i < 5; i++) {
                waveContainer.appendChild(createWaveBar());
            }

            visualizer.appendChild(waveContainer);
        };

        // 监听录音状态变化
        document.addEventListener('recordingStateChanged', (e) => {
            if (e.detail.isRecording) {
                showWaveform();
            } else {
                const waveform = visualizer.querySelector('.audio-wave');
                if (waveform) {
                    waveform.remove();
                }
            }
        });
    }

    addLoadingStates() {
        // 为按钮添加加载状态
        const addLoadingToButton = (button, text = '处理中...') => {
            const originalText = button.textContent;
            const originalHTML = button.innerHTML;

            button.disabled = true;
            button.innerHTML = `
                <div class="loading-spinner" style="width: 16px; height: 16px; margin-right: 8px;"></div>
                ${text}
            `;

            return () => {
                button.disabled = false;
                button.innerHTML = originalHTML;
            };
        };

        // 导出加载状态方法
        window.UIEnhancer = window.UIEnhancer || {};
        window.UIEnhancer.addLoadingToButton = addLoadingToButton;
    }

    addStatusFeedback() {
        // 创建状态提示容器
        const statusContainer = document.createElement('div');
        statusContainer.id = 'statusContainer';
        statusContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(statusContainer);

        // 显示状态消息
        const showStatus = (message, type = 'info', duration = 3000) => {
            const statusEl = document.createElement('div');
            statusEl.className = `status-message status-${type}`;
            statusEl.textContent = message;
            statusEl.style.cssText = `
                background: ${this.getStatusColor(type)};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                margin-bottom: 10px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
                animation: slideInRight 0.3s ease-out;
                pointer-events: auto;
            `;

            statusContainer.appendChild(statusEl);

            setTimeout(() => {
                statusEl.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    statusEl.remove();
                }, 300);
            }, duration);
        };

        // 导出状态显示方法
        window.showStatus = showStatus;
    }

    getStatusColor(type) {
        const colors = {
            success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            error: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            warning: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        };
        return colors[type] || colors.info;
    }

    // 添加页面切换动画
    addPageTransitions() {
        const pages = document.querySelectorAll('.page');

        pages.forEach(page => {
            page.addEventListener('transitionend', () => {
                if (!page.classList.contains('active')) {
                    page.style.display = 'none';
                }
            });
        });
    }

    // 添加进度指示器
    addProgressIndicator() {
        const progressBar = document.createElement('div');
        progressBar.id = 'globalProgress';
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 0%;
            height: 3px;
            background: var(--accent-gradient);
            z-index: 10000;
            transition: width 0.3s ease;
        `;
        document.body.appendChild(progressBar);

        // 导出进度控制方法
        window.setProgress = (percent) => {
            progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
            if (percent >= 100) {
                setTimeout(() => {
                    progressBar.style.width = '0%';
                }, 500);
            }
        };
    }

    // 添加音频可视化
    addAudioVisualization() {
        // 这里可以添加更复杂的音频可视化效果
        // 比如频谱分析、波形显示等
        console.log('音频可视化功能已准备就绪');
    }

    // 添加主题切换
    addThemeToggle() {
        const themeToggle = document.createElement('button');
        themeToggle.innerHTML = '🌙';
        themeToggle.className = 'theme-toggle';
        themeToggle.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: none;
            background: var(--bg-glass);
            backdrop-filter: blur(10px);
            color: var(--text-primary);
            font-size: 20px;
            cursor: pointer;
            z-index: 1000;
            transition: all 0.3s ease;
        `;

        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            themeToggle.innerHTML = document.body.classList.contains('light-theme') ? '☀️' : '🌙';
        });

        document.body.appendChild(themeToggle);
    }
}

// 右下角“清空本地缓存”按钮的逻辑绑定
(function bindClearCacheButton(){
  const btn = document.getElementById('clearCacheBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!confirm('确定要清空本地音频缓存吗？此操作不可恢复。')) return;
    try {
      // 清空 IndexedDB
      if (typeof clearAllAudioBlobs === 'function') {
        await clearAllAudioBlobs();
      }
      // 清空列表
      localStorage.removeItem('recordings');
      // 清空上传缓存
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('upload_cache_meta_')) {
          localStorage.removeItem(key);
        }
      });
      if (window.app) {
        window.app.recordings = [];
        window.app.updateCollectionCount();
        window.app.loadRecentRecords();
      }
      // 隐藏重试按钮
      const retryBtn = document.getElementById('retryUploadBtn');
      if (retryBtn) retryBtn.style.display = 'none';

      alert('已清空本地音频缓存与记录');
    } catch (e) {
      console.error('清空本地音频缓存失败', e);
      alert('清空失败，请查看控制台错误');
    }
  });
})();

// 右下角"重试上传"按钮的逻辑绑定
(function bindRetryUploadButton(){
  const btn = document.getElementById('retryUploadBtn');
  if (!btn) return;

  // 检查是否有待重试的文件
  function checkPendingUploads() {
    const hasPending = Object.keys(localStorage).some(key =>
      key.startsWith('upload_cache_meta_')
    );
    btn.style.display = hasPending ? 'block' : 'none';
  }

  // 初始检查
  checkPendingUploads();

  // 定期检查
  setInterval(checkPendingUploads, 5000);

  btn.addEventListener('click', async () => {
    if (!window.app || typeof window.app.retryPendingUploads !== 'function') {
      alert('重试功能不可用');
      return;
    }

    btn.disabled = true;
    btn.textContent = '重试中...';

    try {
      await window.app.retryPendingUploads();
      checkPendingUploads(); // 重新检查
    } catch (error) {
      console.error('重试上传失败:', error);
      if (window.showStatus) {
        window.showStatus('重试上传失败: ' + error.message, 'error');
      } else {
        alert('重试上传失败: ' + error.message);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '重试上传';
    }
  });
})();

// 初始化UI增强功能
document.addEventListener('DOMContentLoaded', () => {
    new UIEnhancer();
});

// 添加必要的CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }

    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
