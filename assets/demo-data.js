// 演示数据
const demoData = {
    // 预设的录音记录
    recordings: [
        {
            id: "demo_1",
            title: "张总面访记录",
            duration: 920000, // 15分20秒
            createdAt: "2024-01-15T10:30:00Z",
            status: "completed",
            transcription: {
                text: "今天我拜访了张总，他是一家制造业公司的老板，45岁左右，已婚，有两个孩子在上中学。张总对我们的产品很感兴趣，特别是我提到的风险保障功能，他说最近行业竞争激烈，确实需要为家庭和企业做一些保障规划。不过他提出了保费预算的问题，希望能有更灵活的缴费方式。我建议他可以考虑分期缴费，并且承诺下周给他准备一个详细的方案。整体来说这次面访效果不错，客户意向度比较高。",
                confidence: 0.95
            },
            analysis: {
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
            }
        },
        {
            id: "demo_2",
            title: "李女士客户盘点",
            duration: 680000, // 11分20秒
            createdAt: "2024-01-14T14:15:00Z",
            status: "completed",
            transcription: {
                text: "李女士是我们的老客户，今年38岁，单身，在一家外企做财务总监。她之前购买了我们的重疾险，现在想了解一下养老规划的产品。李女士比较理性，对产品的收益率和风险都很关注，她希望能有一个长期稳定的投资计划。我向她介绍了我们的年金险产品，她表示需要回去仔细考虑一下，特别是想了解一下税收优惠政策。我答应她会整理相关的税收政策资料，下周再联系她。",
                confidence: 0.92
            },
            analysis: {
                businessType: "盘户计划",
                customerInfo: {
                    name: "李女士",
                    customerId: "未提及"
                },
                customerProfile: ["中年", "单身", "财务总监", "外企", "理性"],
                followUpPlan: "整理税收优惠政策资料，下周联系客户，重点介绍年金险的税收优势",
                optionalFields: {
                    demandStimulation: "通过养老规划需求，引导客户关注长期投资",
                    objectionHandling: "针对收益率和风险关注，提供详细的产品说明",
                    customerTouchPoint: "税收优惠政策是客户关注的重点",
                    extendedThinking: "可以针对外企高管群体推广税收优惠型产品"
                }
            }
        },
        {
            id: "demo_3",
            title: "王先生失败复盘",
            duration: 450000, // 7分30秒
            createdAt: "2024-01-13T16:45:00Z",
            status: "completed",
            transcription: {
                text: "今天和王先生的面谈没有达到预期效果。王先生是一个比较谨慎的人，对保险产品有一些偏见，认为保险就是骗人的。我在介绍产品时可能过于急躁，没有充分了解他的真实需求就开始推销产品。他明确表示暂时不考虑购买任何保险产品。我觉得这次失败的主要原因是我没有建立足够的信任关系，而且对他的需求分析不够深入。下次应该先从了解客户开始，建立信任关系，再逐步介绍产品。",
                confidence: 0.88
            },
            analysis: {
                businessType: "失败复盘",
                customerInfo: {
                    name: "王先生",
                    customerId: "未提及"
                },
                customerProfile: ["谨慎", "对保险有偏见"],
                followUpPlan: "暂不跟进，需要重新制定接触策略，先建立信任关系",
                optionalFields: {
                    failureReview: "过于急躁推销，未充分了解客户需求，信任关系建立不足",
                    extendedThinking: "对于有保险偏见的客户，应该先从教育和信任建立开始，不要急于推销产品"
                }
            }
        },
        {
            id: "demo_4",
            title: "成功签单经验总结",
            duration: 780000, // 13分钟
            createdAt: "2024-01-12T11:20:00Z",
            status: "completed",
            transcription: {
                text: "今天成功签下了陈总的单子，这是一个很好的案例。陈总是通过朋友介绍认识的，他经营一家餐饮连锁店，对风险管理很有意识。我在和他交流时，重点强调了企业经营风险和家庭责任风险，这正好击中了他的痛点。他最担心的是万一自己出现意外，家庭和企业怎么办。我为他设计了一个组合方案，包括定期寿险和重疾险，保额覆盖了他的房贷和企业贷款。陈总很快就决定购买了，整个过程非常顺利。这次成功的关键是准确把握了客户的核心需求。",
                confidence: 0.96
            },
            analysis: {
                businessType: "优秀经验",
                customerInfo: {
                    name: "陈总",
                    customerId: "未提及"
                },
                customerProfile: ["企业主", "餐饮业", "风险意识强", "朋友介绍"],
                followUpPlan: "维护好客户关系，可以通过陈总介绍更多餐饮业客户",
                optionalFields: {
                    demandStimulation: "通过企业经营风险和家庭责任风险激发需求",
                    customerTouchPoint: "准确把握客户对意外风险的担忧，设计针对性方案",
                    extendedThinking: "餐饮业客户群体值得深入开发，可以设计行业专属产品"
                }
            }
        }
    ],

    // 热门精选数据
    hotPicks: [
        {
            id: "hot_1",
            title: "高净值客户开发技巧",
            author: "资深经理 - 刘总",
            plays: 1250,
            likes: 89,
            tags: ["高端客户", "开发技巧", "成功案例"],
            description: "分享如何接触和服务高净值客户的实战经验"
        },
        {
            id: "hot_2", 
            title: "异议处理黄金话术",
            author: "金牌销售 - 王经理",
            plays: 2100,
            likes: 156,
            tags: ["异议处理", "话术技巧", "实战"],
            description: "总结常见客户异议的处理方法和话术"
        },
        {
            id: "hot_3",
            title: "年轻客户群体开发策略",
            author: "新锐顾问 - 小张",
            plays: 890,
            likes: 67,
            tags: ["年轻客户", "互联网营销", "创新"],
            description: "如何利用新媒体和创新方式开发年轻客户"
        }
    ],

    // 业务类别选项
    businessTypes: [
        "盘户计划",
        "面访跟踪", 
        "优秀经验",
        "失败复盘"
    ],

    // 常用客户画像标签
    customerTags: [
        "中年", "青年", "老年",
        "已婚", "单身", "离异",
        "企业主", "高管", "公务员", "教师", "医生", "工程师",
        "孩子幼儿园", "孩子小学", "孩子中学", "孩子大学",
        "制造业", "金融业", "教育业", "医疗业", "IT业", "餐饮业",
        "风险意识强", "理性", "谨慎", "冲动", "健谈", "内向"
    ],

    // 模拟API响应延迟
    apiDelays: {
        asr: 2000,      // ASR转录延迟2秒
        llm: 3000,      // LLM分析延迟3秒
        feishu: 1000    // 飞书同步延迟1秒
    }
};

// 初始化演示数据到localStorage
function initDemoData() {
    // 如果localStorage中没有数据，则使用演示数据
    const existingRecordings = localStorage.getItem('recordings');
    if (!existingRecordings) {
        localStorage.setItem('recordings', JSON.stringify(demoData.recordings));
        console.log('演示数据已初始化');
    }
}

// 获取随机演示数据
function getRandomDemoData() {
    const randomRecording = demoData.recordings[Math.floor(Math.random() * demoData.recordings.length)];
    return {
        transcription: randomRecording.transcription,
        analysis: randomRecording.analysis
    };
}

// 生成随机客户画像
function generateRandomCustomerProfile() {
    const tags = [];
    
    // 年龄
    tags.push(demoData.customerTags[Math.floor(Math.random() * 3)]);
    
    // 婚姻状况
    tags.push(demoData.customerTags[3 + Math.floor(Math.random() * 3)]);
    
    // 职业
    tags.push(demoData.customerTags[6 + Math.floor(Math.random() * 6)]);
    
    // 孩子情况（50%概率）
    if (Math.random() > 0.5) {
        tags.push(demoData.customerTags[12 + Math.floor(Math.random() * 4)]);
    }
    
    // 行业（50%概率）
    if (Math.random() > 0.5) {
        tags.push(demoData.customerTags[16 + Math.floor(Math.random() * 6)]);
    }
    
    // 性格特征
    tags.push(demoData.customerTags[22 + Math.floor(Math.random() * 6)]);
    
    return tags;
}

// 模拟网络延迟
function simulateNetworkDelay(type) {
    const delay = demoData.apiDelays[type] || 1000;
    return new Promise(resolve => setTimeout(resolve, delay));
}

// 导出到全局
window.demoData = demoData;
window.initDemoData = initDemoData;
window.getRandomDemoData = getRandomDemoData;
window.generateRandomCustomerProfile = generateRandomCustomerProfile;
window.simulateNetworkDelay = simulateNetworkDelay;

// 页面加载时初始化演示数据
document.addEventListener('DOMContentLoaded', initDemoData);
