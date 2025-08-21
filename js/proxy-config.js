/**
 * 代理服务配置
 * 支持多个代理服务器，自动故障转移
 */

class ProxyConfig {
    constructor() {
        this.proxies = [
            // 本地开发代理（开发环境优先）
            {
                url: 'http://localhost:3001',
                name: '本地开发代理',
                priority: 1,
                devOnly: true // 仅开发环境使用
            },
            // 您自己部署的代理（生产环境）
            {
                url: 'https://your-proxy-domain.vercel.app/api',
                name: '自建代理',
                priority: 2,
                prodOnly: true // 仅生产环境使用
            }
        ];
        
        this.currentProxy = null;
        this.testResults = new Map();
    }

    /**
     * 获取可用的代理URL
     */
    async getAvailableProxy() {
        // 如果已经有可用的代理，直接返回
        if (this.currentProxy && await this.testProxy(this.currentProxy)) {
            return this.currentProxy.url;
        }

        // 测试所有代理
        const availableProxies = [];
        for (const proxy of this.getValidProxies()) {
            if (await this.testProxy(proxy)) {
                availableProxies.push(proxy);
            }
        }

        if (availableProxies.length === 0) {
            throw new Error('没有可用的代理服务器');
        }

        // 选择优先级最高的代理
        availableProxies.sort((a, b) => a.priority - b.priority);
        this.currentProxy = availableProxies[0];
        
        console.log(`✅ 使用代理: ${this.currentProxy.name} (${this.currentProxy.url})`);
        return this.currentProxy.url;
    }

    /**
     * 获取当前环境下有效的代理列表
     */
    getValidProxies() {
        const isDev = window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1';

        return this.proxies.filter(proxy => {
            // 如果是仅开发环境的代理，在生产环境下跳过
            if (proxy.devOnly && !isDev) {
                return false;
            }
            // 如果是仅生产环境的代理，在开发环境下跳过
            if (proxy.prodOnly && isDev) {
                return false;
            }
            return true;
        });
    }

    /**
     * 测试代理是否可用
     */
    async testProxy(proxy) {
        const startTime = Date.now();
        try {
            const testUrl = `${proxy.url}/healthz`;
            const response = await fetch(testUrl, {
                method: 'GET',
                timeout: 5000
            });

            const isAvailable = response.ok;
            this.testResults.set(proxy.url, {
                available: isAvailable,
                lastTest: Date.now(),
                latency: Date.now() - startTime
            });

            return isAvailable;
        } catch (error) {
            console.warn(`代理测试失败: ${proxy.name}`, error);
            this.testResults.set(proxy.url, {
                available: false,
                lastTest: Date.now(),
                error: error.message
            });
            return false;
        }
    }

    /**
     * 添加自定义代理
     */
    addProxy(url, name, priority = 10) {
        this.proxies.push({
            url,
            name,
            priority,
            custom: true
        });
    }

    /**
     * 获取代理状态报告
     */
    getStatusReport() {
        return {
            currentProxy: this.currentProxy,
            testResults: Object.fromEntries(this.testResults),
            availableProxies: this.getValidProxies().length
        };
    }
}

// 创建全局实例
window.proxyConfig = new ProxyConfig();
