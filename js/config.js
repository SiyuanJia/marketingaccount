/**
 * 配置管理
 * 处理API密钥和其他配置项的存储和管理
 */

class ConfigManager {
    constructor() {
        this.storageKey = 'ai-voice-ledger-config';
        this.config = this.loadConfig();
    }

    /**
     * 加载配置
     */
    loadConfig() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.warn('加载配置失败:', error);
        }

        // 返回默认配置
        return {
            dashscope: {
                apiKey: '',
                model: 'paraformer-v2'
            },
            gemini: {
                apiKey: '',
                model: 'gemini-2.5-flash'
            },
            feishu: {
                appId: '',
                appSecret: '',
                appToken: '',
                tableId: '',
                accessToken: ''
            },
            upload: {
                endpoint: '/api/upload/audio',
                maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
                allowedFormats: ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'webm', 'flac']
            },
            ui: {
                theme: 'dark',
                language: 'zh-CN',
                autoSave: true
            }
        };
    }

    /**
     * 保存配置
     */
    saveConfig() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.config));
            return true;
        } catch (error) {
            console.error('保存配置失败:', error);
            return false;
        }
    }

    /**
     * 获取配置项
     */
    get(path) {
        const keys = path.split('.');
        let value = this.config;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }

        return value;
    }

    /**
     * 设置配置项
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.config;

        // 创建嵌套对象路径
        for (const key of keys) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }

        target[lastKey] = value;
        return this.saveConfig();
    }

    /**
     * 设置DashScope API Key
     */
    setDashScopeApiKey(apiKey) {
        const success = this.set('dashscope.apiKey', apiKey);
        if (success && window.apiService) {
            window.apiService.setDashScopeApiKey(apiKey);
        }
        return success;
    }

    /**
     * 获取DashScope API Key
     */
    getDashScopeApiKey() {
        return this.get('dashscope.apiKey');
    }

    /**
     * 检查是否已配置必要的API密钥
     */
    isConfigured() {
        const dashscopeKey = this.getDashScopeApiKey();
        return dashscopeKey && dashscopeKey.length > 0;
    }
    /**
     * 设置Gemini API Key
     */
    setGeminiApiKey(apiKey) {
        const success = this.set('gemini.apiKey', apiKey);
        if (success && window.apiService) {
            window.apiService.setGeminiApiKey(apiKey);
        }
        return success;
    }

    /**
     * 获取Gemini API Key
     */
    getGeminiApiKey() {
        return this.get('gemini.apiKey');
    }

    /**
     * 设置飞书配置
     */
    setFeishuConfig(config) {
        const success = this.set('feishu', { ...this.get('feishu'), ...config });
        if (success && window.apiService) {
            // 更新API服务中的飞书配置
            Object.assign(window.apiService.config.feishu, config);
        }
        return success;
    }

    /**
     * 获取飞书配置
     */
    getFeishuConfig() {
        return this.get('feishu') || {};
    }

    /**
     * 设置飞书访问令牌
     */
    setFeishuAccessToken(token) {
        return this.set('feishu.accessToken', token);
    }

    /**
     * 获取飞书访问令牌
     */
    getFeishuAccessToken() {
        return this.get('feishu.accessToken');
    }

    /**
     * 验证API Key格式
     */
    validateApiKey(apiKey, type = 'dashscope') {
        if (!apiKey || typeof apiKey !== 'string') {
            return { valid: false, error: 'API Key不能为空' };
        }

        switch (type) {
            case 'dashscope':
                // DashScope API Key通常以sk-开头
                if (!apiKey.startsWith('sk-') && apiKey.length < 20) {
                    return { valid: false, error: 'DashScope API Key格式不正确' };
                }
                break;
            case 'gemini':
                // 302.ai Gemini API Key格式验证
                if (!apiKey.startsWith('sk-') && apiKey.length < 20) {
                    return { valid: false, error: '302.ai Gemini API Key格式不正确' };
                }
                break;
        }

        return { valid: true };
    }

    /**
     * 重置配置
     */
    reset() {
        try {
            localStorage.removeItem(this.storageKey);
            this.config = this.loadConfig();
            return true;
        } catch (error) {
            console.error('重置配置失败:', error);
            return false;
        }
    }

    /**
     * 导出配置（不包含敏感信息）
     */
    exportConfig() {
        const exportData = JSON.parse(JSON.stringify(this.config));

        // 移除敏感信息
        if (exportData.dashscope) {
            delete exportData.dashscope.apiKey;
        }
        if (exportData.gemini) {
            delete exportData.gemini.apiKey;
        }
        if (exportData.feishu) {
            delete exportData.feishu.appSecret;
        }

        return exportData;
    }

    /**
     * 显示配置对话框
     */
    showConfigDialog() {
        // 生成随机ID防止浏览器记忆
        const timestamp = Date.now();
        const dashscopeId = `dashscope_${timestamp}`;
        const geminiId = `gemini_${timestamp}`;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'configModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <h3>API配置</h3>

                <!-- AI服务配置 -->
                <div style="margin: 20px 0;">
                    <h4 style="color: var(--text-primary); margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                        🤖 AI服务配置
                    </h4>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-primary);">
                            阿里云DashScope API Key:
                        </label>
                        <input type="text" id="${dashscopeId}"
                               name="api_key_${timestamp}_1"
                               placeholder="sk-xxxxxxxxxxxxxxxx"
                               autocomplete="off" autocapitalize="off" spellcheck="false"
                               data-lpignore="true" data-form-type="other"
                               style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc; background: var(--bg-card); color: var(--text-primary);">
                        <small style="color: var(--text-secondary); display: block; margin-top: 4px;">
                            用于语音识别服务，请在阿里云控制台获取
                        </small>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-primary);">
                            302.ai Gemini API Key:
                        </label>
                        <input type="text" id="${geminiId}"
                               name="api_key_${timestamp}_2"
                               placeholder="sk-xxxxxxxxxxxxxxxx"
                               autocomplete="off" autocapitalize="off" spellcheck="false"
                               data-lpignore="true" data-form-type="other"
                               style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc; background: var(--bg-card); color: var(--text-primary);">
                        <small style="color: var(--text-secondary); display: block; margin-top: 4px;">
                            用于AI分析服务，请在302.ai获取Gemini API Key
                        </small>
                    </div>
                </div>

                <!-- 飞书配置 -->
                <div style="margin: 20px 0;">
                    <h4 style="color: var(--text-primary); margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                        📊 飞书多维表格配置
                    </h4>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-primary);">
                            应用Token (App Token):
                        </label>
                        <input type="text" id="feishuAppToken_${timestamp}"
                               name="feishu_token_${timestamp}_1"
                               placeholder="例如: DaRUb3J4Ba7G7FsMVlpcFJolnzd"
                               autocomplete="off" autocapitalize="off" spellcheck="false"
                               data-lpignore="true" data-form-type="other"
                               style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc; background: var(--bg-card); color: var(--text-primary);">
                        <small style="color: var(--text-secondary); display: block; margin-top: 4px;">
                            多维表格的应用标识，在飞书多维表格URL中可以找到
                        </small>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-primary);">
                            表格ID (Table ID):
                        </label>
                        <input type="text" id="feishuTableId_${timestamp}"
                               name="feishu_token_${timestamp}_2"
                               placeholder="例如: tblM4mby6pl1zXdL"
                               autocomplete="off" autocapitalize="off" spellcheck="false"
                               data-lpignore="true" data-form-type="other"
                               style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc; background: var(--bg-card); color: var(--text-primary);">
                        <small style="color: var(--text-secondary); display: block; margin-top: 4px;">
                            具体表格的ID，在表格URL中可以找到
                        </small>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-primary);">
                            访问令牌 (Access Token):
                        </label>
                        <input type="text" id="feishuAccessToken_${timestamp}"
                               name="feishu_token_${timestamp}_3"
                               placeholder="例如: t-g1048gkkI3UPZ5LW6SWOOFUNAWJFDFEIVRLL4WRH"
                               autocomplete="off" autocapitalize="off" spellcheck="false"
                               data-lpignore="true" data-form-type="other"
                               style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc; background: var(--bg-card); color: var(--text-primary);">
                        <small style="color: var(--text-secondary); display: block; margin-top: 4px;">
                            飞书应用的访问令牌，在飞书开放平台获取
                        </small>
                    </div>
                </div>

                <div style="margin: 15px 0; padding: 10px; background: var(--bg-card); border-radius: 8px;">
                    <small style="color: var(--text-secondary);">
                        💡 <strong>纯前端方案</strong>：无需后端配置，使用免费文件托管服务<br>
                        🔄 自动容错：TmpFiles.org → 0x0.st → File.io
                    </small>
                </div>

                <div class="modal-actions">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        取消
                    </button>
                    <button class="btn-primary" onclick="window.configManager.saveAllConfig()">
                        保存配置
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 存储动态ID供后续使用
        modal.dashscopeId = dashscopeId;
        modal.geminiId = geminiId;
        modal.timestamp = timestamp;

        // 确保输入框为空（防止浏览器自动填充）
        const clearInputs = () => {
            const inputs = [
                dashscopeId,
                geminiId,
                `feishuAppToken_${timestamp}`,
                `feishuTableId_${timestamp}`,
                `feishuAccessToken_${timestamp}`
            ];

            inputs.forEach(inputId => {
                const input = document.getElementById(inputId);
                if (input) {
                    // 多种方法确保清空
                    input.value = '';
                    input.defaultValue = '';
                    input.setAttribute('value', '');

                    // 触发input事件确保清空
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        };

        // 立即清空一次
        clearInputs();

        // 延迟再清空一次，防止浏览器延迟填充
        setTimeout(clearInputs, 50);
        setTimeout(clearInputs, 200);
        setTimeout(clearInputs, 500);
    }

    /**
     * 保存所有配置（从对话框）
     */
    saveAllConfig() {
        const modal = document.getElementById('configModal');
        if (!modal) return;

        const dashscopeInput = document.getElementById(modal.dashscopeId);
        const geminiInput = document.getElementById(modal.geminiId);
        const feishuAppTokenInput = document.getElementById(`feishuAppToken_${modal.timestamp}`);
        const feishuTableIdInput = document.getElementById(`feishuTableId_${modal.timestamp}`);
        const feishuAccessTokenInput = document.getElementById(`feishuAccessToken_${modal.timestamp}`);

        const dashscopeKey = dashscopeInput?.value.trim();
        const geminiKey = geminiInput?.value.trim();
        const feishuAppToken = feishuAppTokenInput?.value.trim();
        const feishuTableId = feishuTableIdInput?.value.trim();
        const feishuAccessToken = feishuAccessTokenInput?.value.trim();

        let hasChanges = false;
        let errors = [];

        // 保存DashScope API Key
        if (dashscopeKey) {
            const validation = this.validateApiKey(dashscopeKey, 'dashscope');
            if (!validation.valid) {
                errors.push(`DashScope API Key: ${validation.error}`);
            } else if (this.setDashScopeApiKey(dashscopeKey)) {
                hasChanges = true;
            }
        }

        // 保存Gemini API Key
        if (geminiKey) {
            const validation = this.validateApiKey(geminiKey, 'gemini');
            if (!validation.valid) {
                errors.push(`Gemini API Key: ${validation.error}`);
            } else if (this.setGeminiApiKey(geminiKey)) {
                hasChanges = true;
            }
        }

        // 保存飞书配置
        if (feishuAppToken || feishuTableId || feishuAccessToken) {
            const feishuConfig = {};
            if (feishuAppToken) feishuConfig.appToken = feishuAppToken;
            if (feishuTableId) feishuConfig.tableId = feishuTableId;
            if (feishuAccessToken) feishuConfig.accessToken = feishuAccessToken;

            if (this.setFeishuConfig(feishuConfig)) {
                hasChanges = true;
                console.log('✅ 飞书配置已保存:', feishuConfig);
            }
        }

        // 显示结果
        if (errors.length > 0) {
            alert('配置保存时发现错误:\n' + errors.join('\n'));
            return;
        }

        if (hasChanges) {
            alert('配置保存成功！');
            const modal = document.getElementById('configModal') || document.querySelector('.modal-overlay');
            if (modal) modal.remove();
        } else {
            alert('请至少输入一项配置');
        }
    }

    /**
     * 保存API Key（从对话框）
     */
    saveApiKey() {
        const dashscopeInput = document.getElementById('dashscopeApiKey');
        const geminiInput = document.getElementById('geminiApiKey');

        const dashscopeKey = dashscopeInput.value.trim();
        const geminiKey = geminiInput.value.trim();

        let hasChanges = false;

        // 保存DashScope API Key
        if (dashscopeKey) {
            const validation = this.validateApiKey(dashscopeKey, 'dashscope');
            if (!validation.valid) {
                alert(validation.error);
                return;
            }
            if (this.setDashScopeApiKey(dashscopeKey)) {
                hasChanges = true;
            }
        }

        // 保存Gemini API Key
        if (geminiKey) {
            const validation = this.validateApiKey(geminiKey, 'gemini');
            if (!validation.valid) {
                alert(validation.error);
                return;
            }
            if (this.setGeminiApiKey(geminiKey)) {
                hasChanges = true;
            }
        }

        if (hasChanges) {
            alert('API Key保存成功！');
            const modal = document.getElementById('configModal') || document.querySelector('.modal-overlay');
            if (modal) modal.remove();
        } else {
            alert('请至少输入一个API Key');
        }
    }
}

// 创建全局配置管理器实例
window.configManager = new ConfigManager();
