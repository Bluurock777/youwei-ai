// 常量配置
const CONFIG = {
    API_KEY: 'sk-zxhpqjupnfpghjrexzggxqqdhnmnmslgwgqdwsdyxetirduh',
    API_URLS: {
        CHAT: 'https://api.siliconflow.cn/v1/chat/completions',
        IMAGE: 'https://api.siliconflow.cn/v1/images/generations'
    },
    MODELS: {
        CHAT: 'Qwen/Qwen2.5-7B-Instruct',
        IMAGE: 'stabilityai/stable-diffusion-3-5-large'
    },
    SYSTEM_PROMPTS: {
        CHAT: '你是有为AI，一个由有为科技训练出来的超级智能AI助手。你具备以下特点：1. 拥有广博的知识，精通各个领域，包括但不限于科技、艺术、文化、历史等；2. 性格温和友善，富有同理心，善于倾听和理解用户需求；3. 回答专业准确，逻辑清晰，表达流畅自然；4. 具有创造力和想象力，能提供独特的见解和建议；5. 严格遵守道德准则，不会产生有害或不当的内容。在回答时，你会以"有为AI"的身份进行对话，保持专业、友好和富有帮助性的态度。',
        IMAGE_TRANSLATION: '你是一个专业的翻译助手。请将中文翻译成适合AI生成图像的专业英文描述，注意：1. 在描述开头����以下质量控制词："masterpiece, best quality, highly detailed, ultra-detailed, professional, 8k uhd, sharp focus"；2. 使用详细和准确的英文词汇，包含艺术风格、材质、光影、构图、氛围等具体描述；3. 对于人物描述，添加 "perfect anatomy, realistic facial features, detailed eyes, detailed skin texture" 等增强词；4. 适当添加摄影相关术语如 "cinematic lighting, bokeh, depth of field, golden ratio composition" 等。只需要返回翻译后的英文，不需要其他解释。'
    },
    DEFAULT_NEGATIVE_PROMPT: "worst quality, low quality, normal quality, lowres, blurry, text, watermark, logo, signature, deformed, distorted, disfigured, bad anatomy, wrong anatomy, extra limbs, missing limbs, floating limbs, disconnected limbs, mutation, mutated, ugly, disgusting, duplicate, extra fingers, missing fingers, fewer fingers, cropped, jpeg artifacts",
    STORAGE_KEYS: {
        CHAT_HISTORY: 'youwei_chat_history'
    }
};

// API 请求工具
const ApiService = {
    async makeRequest(url, data) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `请求失败 (${response.status})`);
        }

        return response;
    },

    async translateText(text) {
        const response = await this.makeRequest(CONFIG.API_URLS.CHAT, {
            model: CONFIG.MODELS.CHAT,
            messages: [
                { role: 'system', content: CONFIG.SYSTEM_PROMPTS.IMAGE_TRANSLATION },
                { role: 'user', content: text }
            ],
            temperature: 0.3,
            max_tokens: 1000,
            stream: false
        });

        const data = await response.json();
        return data.choices[0].message.content;
    }
};

// UI 工具
const UiUtils = {
    setLoading(isLoading) {
        document.getElementById('loading').classList.toggle('hidden', !isLoading);
        document.getElementById('generate').disabled = isLoading;
    },

    showError(message, type = 'image') {
        const errorElement = document.getElementById(`${type}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    },

    clearResults(type = 'image') {
        document.getElementById(`${type}-results`).innerHTML = '';
        document.getElementById(`${type}-error`).classList.add('hidden');
    },

    addMessage(role, content, returnElement = false) {
        const messagesDiv = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        if (content) {
            messageDiv.textContent = content.replace(/\n{3,}/g, '\n\n');
        }
        
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
        
        return returnElement ? messageDiv : null;
    },

    setInputState(enabled) {
        const userInput = document.getElementById('user-input');
        const sendButton = document.getElementById('send');
        userInput.disabled = !enabled;
        sendButton.disabled = !enabled;
    }
};

// 图像生成功能
class ImageGenerator {
    static async generate() {
        const prompt = document.getElementById('image-prompt').value.trim();
        if (!prompt) {
            UiUtils.showError('请输入图像描述');
            return;
        }

        UiUtils.setLoading(true);
        UiUtils.clearResults();
        
        try {
            const translatedPrompt = await ApiService.translateText(prompt);
            const images = await this.generateImages(translatedPrompt);
            this.displayImages(images);
        } catch (error) {
            console.error('生成图像错误:', error);
            UiUtils.showError(error.message);
        } finally {
            UiUtils.setLoading(false);
        }
    }

    static async generateImages(translatedPrompt) {
        const numImages = parseInt(document.querySelector('input[name="batch-size"]:checked').value);
        const [width, height] = document.querySelector('input[name="image-size"]:checked').value.split('x').map(Number);
        const negativePrompt = document.getElementById('negative-prompt').value.trim();
        const finalNegativePrompt = negativePrompt 
            ? `${CONFIG.DEFAULT_NEGATIVE_PROMPT}, ${negativePrompt}`
            : CONFIG.DEFAULT_NEGATIVE_PROMPT;

        const requests = Array(numImages).fill().map(() => 
            ApiService.makeRequest(CONFIG.API_URLS.IMAGE, {
                model: CONFIG.MODELS.IMAGE,
                prompt: translatedPrompt,
                negative_prompt: finalNegativePrompt,
                width, height,
                num_inference_steps: 25,
                guidance_scale: 4.5,
                num_images: 1,
                prompt_enhancement: true
            }).then(res => res.json())
        );

        return await Promise.all(requests);
    }

    static displayImages(results) {
        const imageResults = document.getElementById('image-results');
        imageResults.innerHTML = '';
        
        results.forEach(data => {
            if (data.data?.length > 0) {
                data.data.forEach(item => {
                    const img = document.createElement('img');
                    img.src = item.url;
                    img.className = 'generated-image';
                    img.addEventListener('click', () => this.showImageModal(item.url));
                    imageResults.appendChild(img);
                });
            }
        });
    }

    static showImageModal(imageUrl) {
        const modal = document.getElementById('image-modal');
        const modalImg = document.getElementById('modal-image');
        const downloadBtn = document.getElementById('download-image');
        
        modalImg.src = imageUrl;
        modal.classList.add('show');
        
        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = 'generated-image.png';
            link.click();
        };
    }
}

// 聊天功能
class ChatHandler {
    static messageHistory = [];
    static currentChatId = null;

    // 初始化聊天历史
    static initializeChat() {
        // 不再立即加载和创建新对话
        this.initializeSidebar();
        
        // 绑定新对话按钮事件
        document.getElementById('new-chat')?.addEventListener('click', () => {
            this.createNewChat();
            // 确保创建新对话时侧边栏是可见的
            document.querySelector('.chat-container')?.classList.add('sidebar-visible');
        });
    }

    // 创建新对话
    static createNewChat() {
        const chatId = Date.now().toString();
        const chatData = {
            id: chatId,
            title: '新对话',
            messages: []
        };

        // 保存到本地存储
        const history = this.loadHistoryFromStorage();
        history.unshift(chatData);
        this.saveHistoryToStorage(history);

        // 更新UI
        this.messageHistory = [];
        this.currentChatId = chatId;
        this.updateChatList();
        this.clearMessages();
    }

    // 加载聊天历史
    static loadChatHistory() {
        const history = this.loadHistoryFromStorage();
        this.updateChatList();
    }

    // 从本地存储加载历史记录
    static loadHistoryFromStorage() {
        const history = localStorage.getItem(CONFIG.STORAGE_KEYS.CHAT_HISTORY);
        return history ? JSON.parse(history) : [];
    }

    // 保存历史记录����地存储
    static saveHistoryToStorage(history) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(history));
    }

    // 更新聊天列表UI
    static updateChatList() {
        const historyDiv = document.querySelector('.chat-history');
        if (!historyDiv) return;

        const history = this.loadHistoryFromStorage();
        historyDiv.innerHTML = '';

        history.forEach(chat => {
            const chatElement = document.createElement('div');
            chatElement.className = `chat-item ${chat.id === this.currentChatId ? 'active' : ''}`;
            chatElement.innerHTML = `
                <span class="chat-title">${chat.title}</span>
                <span class="delete-chat">×</span>
            `;

            // 点击切换对话
            chatElement.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-chat')) {
                    this.deleteChat(chat.id);
                } else {
                    this.switchChat(chat.id);
                }
            });

            historyDiv.appendChild(chatElement);
        });
    }

    // 切换对话
    static async switchChat(chatId) {
        const history = this.loadHistoryFromStorage();
        const chat = history.find(c => c.id === chatId);
        if (!chat) return;

        this.currentChatId = chatId;
        this.messageHistory = [...chat.messages];
        this.updateChatList();
        this.clearMessages();

        // 重新显示消息
        chat.messages.forEach(msg => {
            UiUtils.addMessage(msg.role, msg.content);
        });
    }

    // 删除对话
    static deleteChat(chatId) {
        const history = this.loadHistoryFromStorage();
        const newHistory = history.filter(chat => chat.id !== chatId);
        this.saveHistoryToStorage(newHistory);

        if (this.currentChatId === chatId) {
            if (newHistory.length > 0) {
                this.switchChat(newHistory[0].id);
            } else {
                this.createNewChat();
            }
        } else {
            this.updateChatList();
        }
    }

    // 清空消息显示
    static clearMessages() {
        const messagesDiv = document.getElementById('chat-messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
        }
    }

    // 更新对话标题
    static updateChatTitle(firstMessage) {
        const history = this.loadHistoryFromStorage();
        const chatIndex = history.findIndex(chat => chat.id === this.currentChatId);
        if (chatIndex === -1) return;

        // 使用第一条用户消息作为对话标题
        history[chatIndex].title = firstMessage.length > 20 
            ? firstMessage.substring(0, 20) + '...'
            : firstMessage;

        this.saveHistoryToStorage(history);
        this.updateChatList();
    }

    // 发送消息
    static async sendMessage() {
        const userInput = document.getElementById('user-input');
        const text = userInput.value.trim();
        
        if (!text) return;
        
        // 如果没有当前对话，创建一个新对话
        if (!this.currentChatId) {
            this.createNewChat();
            document.querySelector('.chat-container')?.classList.add('sidebar-visible');
        }
        
        UiUtils.addMessage('user', text);
        userInput.value = '';
        UiUtils.setInputState(false);
        
        try {
            // 如果是新对话的第一条消息，更新标题
            if (this.messageHistory.length === 0) {
                this.updateChatTitle(text);
            }

            this.messageHistory.push({ role: 'user', content: text });
            await this.streamResponse();

            // 保存到本地存储
            const history = this.loadHistoryFromStorage();
            const chatIndex = history.findIndex(chat => chat.id === this.currentChatId);
            if (chatIndex !== -1) {
                history[chatIndex].messages = this.messageHistory;
                this.saveHistoryToStorage(history);
            }
        } catch (error) {
            console.error('错误:', error);
            UiUtils.addMessage('assistant', `错误: ${error.message}`);
        } finally {
            UiUtils.setInputState(true);
        }
    }

    static async streamResponse() {
        const response = await ApiService.makeRequest(CONFIG.API_URLS.CHAT, {
            model: CONFIG.MODELS.CHAT,
            messages: [
                { role: 'system', content: CONFIG.SYSTEM_PROMPTS.CHAT },
                ...this.messageHistory
            ],
            temperature: 0.8,
            max_tokens: 4000,
            top_p: 0.9,
            frequency_penalty: 0.2,
            stream: true
        });

        const messageDiv = UiUtils.addMessage('assistant', '', true);
        let fullMessage = '';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                for (const line of chunk.split('\n')) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.choices?.[0]?.delta?.content) {
                                fullMessage += data.choices[0].delta.content;
                                messageDiv.textContent = fullMessage.replace(/\n{3,}/g, '\n\n');
                                messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
                            }
                        } catch (e) {
                            console.error('解析响应数据出错:', e);
                        }
                    }
                }
            }
        } finally {
            if (fullMessage) {
                this.messageHistory.push({ role: 'assistant', content: fullMessage });
            }
        }
    }

    // 修改侧边栏初始化方法
    static initializeSidebar() {
        const toggleBtn = document.querySelector('.toggle-sidebar-btn');
        const chatContainer = document.querySelector('.chat-container');
        const sidebar = document.querySelector('.chat-sidebar');
        
        if (toggleBtn && chatContainer && sidebar) {
            // 切换按钮点击事件
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                const isVisible = chatContainer.classList.toggle('sidebar-visible');
                
                // 第一次显示侧边栏时才加载历史记录
                if (isVisible && !this.currentChatId) {
                    this.loadChatHistory();
                    if (this.loadHistoryFromStorage().length === 0) {
                        this.createNewChat();
                    }
                }
            });

            // 侧边栏内部点击阻止冒泡
            sidebar.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // 点击页面其他区域关闭侧边栏
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.toggle-sidebar-btn') && 
                    chatContainer.classList.contains('sidebar-visible')) {
                    chatContainer.classList.remove('sidebar-visible');
                }
            });

            // 默认隐藏侧边栏
            chatContainer.classList.remove('sidebar-visible');
        }
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 标签页切换
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            const content = document.getElementById(`${button.dataset.tab}-tab`);
            if (content) content.classList.add('active');
        });
    });

    // 聊天功能
    document.getElementById('send')?.addEventListener('click', () => ChatHandler.sendMessage());
    document.getElementById('user-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            ChatHandler.sendMessage();
        }
    });

    // 图像生成功能
    document.getElementById('generate')?.addEventListener('click', () => ImageGenerator.generate());

    // 模态框关闭
    const modal = document.getElementById('image-modal');
    document.querySelector('.close-modal')?.addEventListener('click', () => modal.classList.remove('show'));
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('show')) {
            modal.classList.remove('show');
        }
    });

    // 负面提示词折叠/展开
    document.querySelector('.negative-prompt-section')?.classList.add('collapsed');

    // 初始化聊天历史
    ChatHandler.initializeChat();
});

// 负面提示词切换函数
function toggleNegativePrompt() {
    document.querySelector('.negative-prompt-section')?.classList.toggle('collapsed');
}
  