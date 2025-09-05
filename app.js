// Reddit Assistant Pro - Real API Integration
// This application connects to live Reddit and Gemini APIs

// API Configuration
const CONFIG = {
    reddit: {
        baseUrl: 'https://www.reddit.com',
        oauthUrl: 'https://oauth.reddit.com',
        userAgent: 'RedditAssistantPro:v1.0 (by /u/YourUsername)',
        rateLimitPerMinute: 60,
        requestDelay: 1000 // 1 second between requests
    },
    gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-pro'
    }
};

// Global State Management
class AppState {
    constructor() {
        this.isAuthenticated = false;
        this.accessToken = null;
        this.refreshToken = null;
        this.userInfo = null;
        this.credentials = null;
        this.geminiApiKey = null;
        this.requestQueue = [];
        this.rateLimitRemaining = 60;
        this.lastRequestTime = 0;
        this.currentTab = 'setup';
    }

    setCredentials(credentials) {
        this.credentials = credentials;
        localStorage.setItem('redditCredentials', JSON.stringify(credentials));
    }

    getCredentials() {
        if (!this.credentials) {
            const saved = localStorage.getItem('redditCredentials');
            this.credentials = saved ? JSON.parse(saved) : null;
        }
        return this.credentials;
    }

    setGeminiKey(key) {
        this.geminiApiKey = key;
        localStorage.setItem('geminiApiKey', key);
    }

    getGeminiKey() {
        if (!this.geminiApiKey) {
            this.geminiApiKey = localStorage.getItem('geminiApiKey');
        }
        return this.geminiApiKey;
    }

    setTokens(accessToken, refreshToken = null) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.isAuthenticated = !!accessToken;
        
        if (accessToken) {
            localStorage.setItem('redditAccessToken', accessToken);
            if (refreshToken) {
                localStorage.setItem('redditRefreshToken', refreshToken);
            }
        } else {
            localStorage.removeItem('redditAccessToken');
            localStorage.removeItem('redditRefreshToken');
        }
        
        this.updateConnectionStatus();
    }

    loadTokensFromStorage() {
        this.accessToken = localStorage.getItem('redditAccessToken');
        this.refreshToken = localStorage.getItem('redditRefreshToken');
        this.isAuthenticated = !!this.accessToken;
        this.updateConnectionStatus();
    }

    updateConnectionStatus() {
        const indicator = document.getElementById('connectionIndicator');
        const statusDot = indicator?.querySelector('.status-dot');
        const statusText = indicator?.querySelector('.status-text');
        
        if (statusDot && statusText) {
            if (this.isAuthenticated) {
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Connected to Reddit';
            } else {
                statusDot.className = 'status-dot offline';
                statusText.textContent = 'Disconnected';
            }
        }
    }
}

// Initialize global state
const appState = new AppState();

// Rate Limiting Manager
class RateLimitManager {
    constructor() {
        this.requests = [];
        this.maxRequests = CONFIG.reddit.rateLimitPerMinute;
        this.windowMs = 60000; // 1 minute
    }

    async canMakeRequest() {
        const now = Date.now();
        // Remove requests older than 1 minute
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = this.windowMs - (now - oldestRequest);
            throw new Error(`Rate limit exceeded. Wait ${Math.ceil(waitTime / 1000)} seconds.`);
        }
        
        return true;
    }

    recordRequest() {
        this.requests.push(Date.now());
        this.updateRateLimitDisplay();
    }

    updateRateLimitDisplay() {
        const container = document.getElementById('rateLimitStatus');
        if (container) {
            const remaining = this.maxRequests - this.requests.length;
            const percentage = (remaining / this.maxRequests) * 100;
            
            container.innerHTML = `
                <div class="rate-limit-item">
                    <div class="rate-limit-header">
                        <span class="rate-limit-api">Reddit API</span>
                        <span class="rate-limit-remaining">${remaining}/${this.maxRequests}</span>
                    </div>
                    <div class="rate-limit-progress">
                        <div class="rate-limit-bar ${percentage < 20 ? 'danger' : percentage < 50 ? 'warning' : ''}" 
                             style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }
    }
}

const rateLimiter = new RateLimitManager();

// API Client for Reddit
class RedditAPI {
    constructor() {
        this.baseHeaders = {
            'User-Agent': CONFIG.reddit.userAgent
        };
    }

    async makeRequest(url, options = {}) {
        try {
            await rateLimiter.canMakeRequest();
            
            const headers = {
                ...this.baseHeaders,
                ...options.headers
            };

            if (appState.accessToken) {
                headers.Authorization = `Bearer ${appState.accessToken}`;
            }

            const response = await fetch(url, {
                ...options,
                headers
            });

            rateLimiter.recordRequest();

            if (response.status === 401) {
                // Token expired, try to refresh
                if (await this.refreshAccessToken()) {
                    headers.Authorization = `Bearer ${appState.accessToken}`;
                    const retryResponse = await fetch(url, { ...options, headers });
                    return this.handleResponse(retryResponse);
                } else {
                    throw new Error('Authentication failed. Please re-authenticate.');
                }
            }

            return this.handleResponse(response);
        } catch (error) {
            console.error('Reddit API request failed:', error);
            throw error;
        }
    }

    async handleResponse(response) {
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            const error = data.error || data.message || `HTTP ${response.status}`;
            throw new Error(error);
        }

        return data;
    }

    async authenticate(credentials) {
        try {
            showToast('Authenticating with Reddit...', 'info');
            
            const auth = btoa(`${credentials.clientId}:${credentials.clientSecret}`);
            
            const response = await fetch(`${CONFIG.reddit.baseUrl}/api/v1/access_token`, {
                method: 'POST',
                headers: {
                    ...this.baseHeaders,
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'password',
                    username: credentials.username,
                    password: credentials.password
                })
            });

            const data = await this.handleResponse(response);
            
            if (data.access_token) {
                appState.setTokens(data.access_token, data.refresh_token);
                showToast('Successfully authenticated with Reddit!', 'success');
                return true;
            } else {
                throw new Error('No access token received');
            }
        } catch (error) {
            showToast(`Authentication failed: ${error.message}`, 'error');
            return false;
        }
    }

    async refreshAccessToken() {
        if (!appState.refreshToken || !appState.credentials) {
            return false;
        }

        try {
            const auth = btoa(`${appState.credentials.clientId}:${appState.credentials.clientSecret}`);
            
            const response = await fetch(`${CONFIG.reddit.baseUrl}/api/v1/access_token`, {
                method: 'POST',
                headers: {
                    ...this.baseHeaders,
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: appState.refreshToken
                })
            });

            const data = await this.handleResponse(response);
            
            if (data.access_token) {
                appState.setTokens(data.access_token, data.refresh_token || appState.refreshToken);
                return true;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
        }
        
        return false;
    }

    async getUserInfo() {
        const url = `${CONFIG.reddit.oauthUrl}/api/v1/me`;
        return await this.makeRequest(url);
    }

    async getUserPosts(username, limit = 25) {
        const url = `${CONFIG.reddit.oauthUrl}/user/${username}/submitted?limit=${limit}`;
        return await this.makeRequest(url);
    }

    async getUserComments(username, limit = 25) {
        const url = `${CONFIG.reddit.oauthUrl}/user/${username}/comments?limit=${limit}`;
        return await this.makeRequest(url);
    }

    async getSubredditPosts(subreddit, sort = 'hot', limit = 25, after = null) {
        let url = `${CONFIG.reddit.oauthUrl}/r/${subreddit}/${sort}?limit=${limit}`;
        if (after) {
            url += `&after=${after}`;
        }
        return await this.makeRequest(url);
    }

    async getPostDetails(subreddit, postId) {
        const url = `${CONFIG.reddit.oauthUrl}/r/${subreddit}/comments/${postId}`;
        return await this.makeRequest(url);
    }

    async submitPost(subreddit, title, content, kind = 'self', url = null) {
        const submitUrl = `${CONFIG.reddit.oauthUrl}/api/submit`;
        const body = new URLSearchParams({
            sr: subreddit,
            title: title,
            kind: kind,
            text: content || '',
            url: url || '',
            api_type: 'json'
        });

        return await this.makeRequest(submitUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body
        });
    }

    async submitComment(thingId, text) {
        const url = `${CONFIG.reddit.oauthUrl}/api/comment`;
        const body = new URLSearchParams({
            thing_id: thingId,
            text: text,
            api_type: 'json'
        });

        return await this.makeRequest(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body
        });
    }
}

// Gemini AI Client
class GeminiAPI {
    constructor() {
        this.baseUrl = CONFIG.gemini.baseUrl;
    }

    async generateContent(prompt, apiKey = null) {
        const key = apiKey || appState.getGeminiKey();
        if (!key) {
            throw new Error('Gemini API key not configured');
        }

        const url = `${this.baseUrl}/models/${CONFIG.gemini.model}:generateContent?key=${key}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topP: 0.8,
                        topK: 40,
                        maxOutputTokens: 1024
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Gemini API request failed');
            }

            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
        } catch (error) {
            console.error('Gemini API error:', error);
            throw error;
        }
    }

    async generateComment(postTitle, postContent, tone = 'helpful') {
        const tonePrompts = {
            helpful: 'Generate a helpful, informative comment that adds value to the discussion',
            funny: 'Create a witty, humorous comment that\'s appropriate and respectful',
            supportive: 'Write a supportive, encouraging comment that shows empathy',
            analytical: 'Provide an analytical, detailed comment with insights or analysis',
            casual: 'Write a casual, friendly comment that engages naturally with the topic'
        };

        const prompt = `
Post Title: ${postTitle}
Post Content: ${postContent}

Instructions: ${tonePrompts[tone] || tonePrompts.helpful}

Please generate a thoughtful Reddit comment (2-4 sentences) that:
1. Is respectful and follows Reddit etiquette
2. Adds value to the conversation
3. Matches the requested tone: ${tone}
4. Is concise but engaging
5. Avoids controversial topics

Comment:`;

        return await this.generateContent(prompt);
    }

    async generatePost(subreddit, topic, type = 'text') {
        const prompt = `
Generate a high-quality Reddit post for r/${subreddit} about: ${topic}

Requirements:
1. Create an engaging, click-worthy title (max 300 characters)
2. Write ${type === 'text' ? 'substantial text content (200-500 words)' : 'a brief description for the link'}
3. Follow r/${subreddit} community guidelines
4. Be informative, helpful, or thought-provoking
5. Use proper Reddit formatting (paragraphs, bullet points if needed)
6. End with a question to encourage discussion

Format your response as:
TITLE: [your title here]
CONTENT: [your content here]`;

        return await this.generateContent(prompt);
    }

    async suggestTopics(subreddit) {
        const prompt = `
Generate 5-7 trending, engaging topic ideas for r/${subreddit} that would perform well on Reddit.

Each topic should be:
1. Relevant to the subreddit's community
2. Likely to generate discussion and engagement
3. Timely or evergreen in nature
4. Original and not overly posted about

Format each topic as a brief, catchy phrase or question (max 60 characters each).

Topics:`;

        return await this.generateContent(prompt);
    }
}

// Initialize API clients
const redditAPI = new RedditAPI();
const geminiAPI = new GeminiAPI();

// UI Management
class UIManager {
    static init() {
        // Set initial theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-color-scheme', savedTheme);
        this.updateThemeToggle(savedTheme);

        // Initialize rate limit display
        rateLimiter.updateRateLimitDisplay();

        // Load saved credentials
        const credentials = appState.getCredentials();
        if (credentials) {
            document.getElementById('clientId').value = credentials.clientId || '';
            document.getElementById('clientSecret').value = credentials.clientSecret || '';
            document.getElementById('redditUsername').value = credentials.username || '';
            // Don't restore password for security
        }

        // Load Gemini API key
        const geminiKey = appState.getGeminiKey();
        if (geminiKey) {
            document.getElementById('geminiApiKey').value = geminiKey;
        }

        // Show karma display if authenticated
        if (appState.isAuthenticated) {
            document.getElementById('karmaDisplay').style.display = 'flex';
        }

        // Load posting queue
        const queue = JSON.parse(localStorage.getItem('postingQueue') || '[]');
        this.updatePostingQueue(queue);
    }

    static switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        appState.currentTab = tabName;

        // Load data for specific tabs
        if (tabName === 'dashboard' && appState.isAuthenticated) {
            DataManager.loadUserData().catch(console.error);
        }
    }

    static setButtonLoading(button, loading) {
        const btnText = button.querySelector('.btn-text');
        const spinner = button.querySelector('.spinner');
        
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
            if (spinner) spinner.classList.remove('hidden');
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            if (spinner) spinner.classList.add('hidden');
        }
    }

    static updateThemeToggle(theme) {
        const toggle = document.getElementById('themeToggle');
        if (toggle) {
            toggle.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
        }
    }

    static updateUserStats(userInfo) {
        const container = document.getElementById('userStats');
        if (!container || !userInfo) return;

        const accountAge = this.calculateAccountAge(userInfo.created_utc);
        
        container.innerHTML = `
            <div class="user-stat-row">
                <span class="user-stat-label">Username</span>
                <span class="user-stat-value">/u/${userInfo.name}</span>
            </div>
            <div class="user-stat-row">
                <span class="user-stat-label">Account Age</span>
                <span class="user-stat-value age">${accountAge}</span>
            </div>
            <div class="user-stat-row">
                <span class="user-stat-label">Total Karma</span>
                <span class="user-stat-value karma">${(userInfo.link_karma + userInfo.comment_karma).toLocaleString()}</span>
            </div>
            <div class="user-stat-row">
                <span class="user-stat-label">Premium Status</span>
                <span class="user-stat-value">${userInfo.is_gold ? 'Premium' : 'Regular'}</span>
            </div>
        `;
    }

    static updateKarmaDisplay(userInfo) {
        const totalKarma = document.getElementById('totalKarma');
        const karmaStats = document.getElementById('karmaStats');
        
        if (totalKarma && userInfo) {
            const total = userInfo.link_karma + userInfo.comment_karma;
            totalKarma.textContent = total.toLocaleString();
            document.getElementById('karmaDisplay').style.display = 'flex';
        }

        if (karmaStats && userInfo) {
            karmaStats.innerHTML = `
                <div class="karma-stat">
                    <div class="karma-number">${userInfo.link_karma.toLocaleString()}</div>
                    <div class="karma-label">Post Karma</div>
                </div>
                <div class="karma-stat">
                    <div class="karma-number">${userInfo.comment_karma.toLocaleString()}</div>
                    <div class="karma-label">Comment Karma</div>
                </div>
                <div class="karma-stat">
                    <div class="karma-number">${(userInfo.link_karma + userInfo.comment_karma).toLocaleString()}</div>
                    <div class="karma-label">Total Karma</div>
                </div>
            `;
        }
    }

    static updateRecentPosts(posts) {
        const container = document.getElementById('recentPosts');
        if (!container) return;

        if (posts.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent posts</div>';
            return;
        }

        container.innerHTML = posts.slice(0, 5).map(item => {
            const post = item.data;
            return `
                <div class="post-item">
                    <div class="post-title">${this.truncateText(post.title, 60)}</div>
                    <div class="post-meta">
                        <span class="post-score">↑ ${post.score}</span>
                        <span>💬 ${post.num_comments}</span>
                        <span>/r/${post.subreddit}</span>
                        <span>${this.timeAgo(post.created_utc)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    static updateRecentComments(comments) {
        const container = document.getElementById('recentComments');
        if (!container) return;

        if (comments.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent comments</div>';
            return;
        }

        container.innerHTML = comments.slice(0, 5).map(item => {
            const comment = item.data;
            return `
                <div class="comment-item">
                    <div class="comment-title">${this.truncateText(comment.body, 80)}</div>
                    <div class="comment-meta">
                        <span class="comment-score">↑ ${comment.score}</span>
                        <span>/r/${comment.subreddit}</span>
                        <span>${this.timeAgo(comment.created_utc)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    static displaySubredditPosts(posts, subreddit, sort) {
        const container = document.getElementById('livePostsContainer');
        const loadingDiv = document.getElementById('postsLoading');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        
        if (loadingDiv) loadingDiv.classList.add('hidden');

        if (posts.length === 0) {
            container.innerHTML = '<div class="empty-state">No posts found</div>';
            return;
        }

        container.innerHTML = posts.map(item => {
            const post = item.data;
            return `
                <div class="live-post-card">
                    <div class="live-post-header">
                        <div>
                            <h3 class="live-post-title" onclick="window.open('https://reddit.com${post.permalink}', '_blank')">${post.title}</h3>
                            <div class="live-post-meta">
                                <span class="subreddit">/r/${post.subreddit}</span> • 
                                <span class="author">/u/${post.author}</span> • 
                                <span class="time">${this.timeAgo(post.created_utc)}</span>
                            </div>
                        </div>
                    </div>
                    ${post.selftext ? `<div class="live-post-content">${this.truncateText(post.selftext, 300)}</div>` : ''}
                    ${post.url && !post.is_self ? `<div class="live-post-content"><a href="${post.url}" target="_blank">🔗 ${post.url}</a></div>` : ''}
                    <div class="live-post-stats">
                        <div class="live-post-stat">
                            <span>⬆️</span>
                            <span>${post.score}</span>
                        </div>
                        <div class="live-post-stat">
                            <span>💬</span>
                            <span>${post.num_comments}</span>
                        </div>
                        <div class="live-post-stat">
                            <span>📊</span>
                            <span>${(post.upvote_ratio * 100).toFixed(0)}% upvoted</span>
                        </div>
                    </div>
                    <div class="live-post-actions">
                        <button class="btn btn--sm btn--primary generate-comment-for-post" data-post-id="${post.id}" data-post-name="${post.name}">
                            🤖 Generate Comment
                        </button>
                        <button class="btn btn--sm btn--outline" onclick="UIManager.copyToClipboard('https://reddit.com${post.permalink}')">
                            📋 Copy URL
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Setup load more button
        const lastPost = posts[posts.length - 1];
        if (lastPost && loadMoreBtn) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.dataset.after = lastPost.data.name;
            loadMoreBtn.dataset.subreddit = subreddit;
            loadMoreBtn.dataset.sort = sort;
        }
    }

    static displayGeneratedComments(comments, post) {
        const container = document.getElementById('generatedComments');
        if (!container) return;

        container.innerHTML = `
            <div class="card">
                <div class="card__header">
                    <h3>Generated Comments for Post</h3>
                </div>
                <div class="card__body">
                    <div class="comment-preview">
                        <h4>${post.title}</h4>
                        <p>${this.truncateText(post.selftext || 'Link post', 200)}</p>
                    </div>
                    ${comments.map(comment => `
                        <div class="generated-comment-item">
                            <div class="comment-header">
                                <span class="comment-tone-badge">${comment.tone}</span>
                                <div class="comment-actions">
                                    <button class="btn btn--sm btn--outline copy-comment-btn" data-comment="${this.escapeHtml(comment.text)}">
                                        📋 Copy
                                    </button>
                                    <button class="btn btn--sm btn--primary post-comment-btn" 
                                            data-comment="${this.escapeHtml(comment.text)}" 
                                            data-thing-id="${comment.postId}">
                                        💬 Post Comment
                                    </button>
                                </div>
                            </div>
                            <div class="comment-text">${comment.text}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    static displayTrendingTopics(topicsText) {
        const container = document.getElementById('trendingTopics');
        if (!container) return;

        // Parse topics from the generated text
        const topics = topicsText.split('\n')
            .filter(line => line.trim())
            .map(line => line.replace(/^\d+\.?\s*/, '').trim())
            .filter(topic => topic.length > 0 && topic.length <= 100);

        container.innerHTML = topics.map(topic => `
            <div class="topic-item" onclick="document.getElementById('postTitle').value = '${this.escapeHtml(topic)}'">
                <span class="topic-text">${topic}</span>
                <span class="topic-trend">📈 Trending</span>
            </div>
        `).join('');
    }

    static updatePostingQueue(queue) {
        const container = document.getElementById('postingQueue');
        if (!container) return;

        if (queue.length === 0) {
            container.innerHTML = '<div class="empty-state">No scheduled posts</div>';
            return;
        }

        container.innerHTML = queue.map(item => `
            <div class="queue-item">
                <div class="queue-item-header">
                    <h4 class="queue-item-title">${this.truncateText(item.title, 50)}</h4>
                    <div class="queue-item-actions">
                        <button class="btn btn--sm btn--secondary">Edit</button>
                        <button class="btn btn--sm btn--outline">Delete</button>
                    </div>
                </div>
                <div class="queue-item-meta">/r/${item.subreddit} • ${item.postType} post</div>
                <div class="queue-item-time">📅 ${this.formatDateTime(item.scheduledTime)}</div>
            </div>
        `).join('');
    }

    static togglePostTypeFields(postType) {
        const contentGroup = document.getElementById('contentGroup');
        const urlGroup = document.getElementById('urlGroup');
        
        if (postType === 'link') {
            contentGroup.classList.add('hidden');
            urlGroup.classList.remove('hidden');
        } else {
            contentGroup.classList.remove('hidden');
            urlGroup.classList.add('hidden');
        }
    }

    static showModal(modal) {
        modal.classList.remove('hidden');
    }

    static hideModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copied to clipboard!', 'success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Copied to clipboard!', 'success');
        }
    }

    // Utility methods
    static truncateText(text, length) {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static timeAgo(unixTimestamp) {
        const now = Date.now() / 1000;
        const diff = now - unixTimestamp;
        
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    static calculateAccountAge(createdUtc) {
        const now = Date.now() / 1000;
        const diff = now - createdUtc;
        const years = Math.floor(diff / (365 * 24 * 3600));
        const months = Math.floor((diff % (365 * 24 * 3600)) / (30 * 24 * 3600));
        
        if (years > 0) {
            return `${years}y ${months}m`;
        } else if (months > 0) {
            return `${months}m`;
        } else {
            const days = Math.floor(diff / (24 * 3600));
            return `${days}d`;
        }
    }

    static formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Data Management
class DataManager {
    static async loadUserData() {
        if (!appState.isAuthenticated) return;

        try {
            const userInfo = await redditAPI.getUserInfo();
            appState.userInfo = userInfo;
            
            // Update UI
            UIManager.updateUserStats(userInfo);
            UIManager.updateKarmaDisplay(userInfo);
            
            // Load recent posts and comments
            await this.loadRecentActivity();
            
        } catch (error) {
            console.error('Failed to load user data:', error);
            throw error;
        }
    }

    static async loadRecentActivity() {
        if (!appState.userInfo) return;

        try {
            const [posts, comments] = await Promise.all([
                redditAPI.getUserPosts(appState.userInfo.name, 10),
                redditAPI.getUserComments(appState.userInfo.name, 10)
            ]);

            UIManager.updateRecentPosts(posts.data?.children || []);
            UIManager.updateRecentComments(comments.data?.children || []);
            
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    }

    static async updateKarma() {
        if (!appState.isAuthenticated) return;

        try {
            const userInfo = await redditAPI.getUserInfo();
            appState.userInfo = userInfo;
            UIManager.updateKarmaDisplay(userInfo);
        } catch (error) {
            console.error('Failed to update karma:', error);
            throw error;
        }
    }

    static async loadSubredditPosts(subreddit, sort = 'hot', timeFilter = null) {
        try {
            const posts = await redditAPI.getSubredditPosts(subreddit, sort, 25);
            UIManager.displaySubredditPosts(posts.data?.children || [], subreddit, sort);
        } catch (error) {
            console.error('Failed to load subreddit posts:', error);
            throw error;
        }
    }

    static async generateCommentsForPost(postUrl, tone) {
        try {
            // Parse post URL to get subreddit and post ID
            const urlMatch = postUrl.match(/reddit\.com\/r\/(\w+)\/comments\/(\w+)/);
            if (!urlMatch) {
                throw new Error('Invalid Reddit post URL');
            }

            const [, subreddit, postId] = urlMatch;
            
            // Get post details
            const postData = await redditAPI.getPostDetails(subreddit, postId);
            const post = postData[0]?.data?.children?.[0]?.data;
            
            if (!post) {
                throw new Error('Post not found');
            }

            // Generate comments using Gemini
            const comments = [];
            const tones = [tone, 'helpful', 'casual']; // Generate multiple variations
            
            for (const currentTone of tones) {
                try {
                    const comment = await geminiAPI.generateComment(post.title, post.selftext, currentTone);
                    comments.push({
                        tone: currentTone,
                        text: comment,
                        postId: post.name
                    });
                } catch (error) {
                    console.error(`Failed to generate ${currentTone} comment:`, error);
                }
            }

            UIManager.displayGeneratedComments(comments, post);
            
        } catch (error) {
            console.error('Failed to generate comments:', error);
            throw error;
        }
    }

    static addToPostingQueue(postData) {
        const queue = JSON.parse(localStorage.getItem('postingQueue') || '[]');
        queue.push({
            ...postData,
            id: Date.now().toString(),
            status: 'scheduled',
            created: new Date().toISOString()
        });
        localStorage.setItem('postingQueue', JSON.stringify(queue));
        UIManager.updatePostingQueue(queue);
    }

    static startPeriodicUpdates() {
        // Update karma every 5 minutes
        setInterval(async () => {
            if (appState.isAuthenticated) {
                try {
                    await this.updateKarma();
                } catch (error) {
                    console.error('Periodic karma update failed:', error);
                }
            }
        }, 5 * 60 * 1000);
    }
}

// Toast notification system
function showToast(message, type = 'info', title = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };

    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${title}</div>` : ''}
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);

    // Click to dismiss
    toast.addEventListener('click', () => {
        toast.remove();
    });
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Reddit Assistant Pro initializing...');
    
    // Load saved data
    appState.loadTokensFromStorage();
    
    // Initialize UI
    UIManager.init();
    
    // Start periodic updates if authenticated
    if (appState.isAuthenticated) {
        DataManager.startPeriodicUpdates();
    }
    
    console.log('Initialization complete');
});

// Event delegation for all clicks
document.addEventListener('click', async function(e) {
    const target = e.target.closest('button') || e.target;
    
    // Tab navigation - FIXED
    if (target.classList.contains('nav-tab')) {
        e.preventDefault();
        const tabName = target.dataset.tab;
        if (tabName) {
            UIManager.switchTab(tabName);
        }
        return;
    }

    // Theme toggle - FIXED
    if (target.id === 'themeToggle') {
        e.preventDefault();
        const currentTheme = document.documentElement.getAttribute('data-color-scheme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-color-scheme', newTheme);
        localStorage.setItem('theme', newTheme);
        UIManager.updateThemeToggle(newTheme);
        
        showToast(`Switched to ${newTheme} theme`, 'success');
        return;
    }

    // Authentication
    if (target.id === 'authenticateBtn') {
        e.preventDefault();
        const form = document.getElementById('redditAuthForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const credentials = {
            clientId: document.getElementById('clientId').value.trim(),
            clientSecret: document.getElementById('clientSecret').value.trim(),
            username: document.getElementById('redditUsername').value.trim(),
            password: document.getElementById('redditPassword').value.trim()
        };

        try {
            UIManager.setButtonLoading(target, true);
            const success = await redditAPI.authenticate(credentials);
            if (success) {
                appState.setCredentials(credentials);
                await DataManager.loadUserData();
                UIManager.switchTab('dashboard');
                DataManager.startPeriodicUpdates();
            }
        } catch (error) {
            showToast(`Authentication failed: ${error.message}`, 'error');
        } finally {
            UIManager.setButtonLoading(target, false);
        }
        return;
    }

    // Save credentials
    if (target.id === 'saveCredentials') {
        e.preventDefault();
        const credentials = {
            clientId: document.getElementById('clientId').value.trim(),
            clientSecret: document.getElementById('clientSecret').value.trim(),
            username: document.getElementById('redditUsername').value.trim(),
            password: document.getElementById('redditPassword').value.trim()
        };

        if (!credentials.clientId || !credentials.clientSecret || !credentials.username || !credentials.password) {
            showToast('Please fill in all credential fields', 'error');
            return;
        }

        appState.setCredentials(credentials);
        showToast('Credentials saved successfully!', 'success');
        return;
    }

    // Test Gemini
    if (target.id === 'testGeminiBtn') {
        e.preventDefault();
        const apiKey = document.getElementById('geminiApiKey').value.trim();
        
        if (!apiKey) {
            showToast('Please enter your Gemini API key', 'error');
            return;
        }

        try {
            UIManager.setButtonLoading(target, true);
            const testResponse = await geminiAPI.generateContent('Say hello and confirm you are working properly', apiKey);
            if (testResponse) {
                appState.setGeminiKey(apiKey);
                showToast('Gemini API connected successfully!', 'success');
            }
        } catch (error) {
            showToast(`Gemini API test failed: ${error.message}`, 'error');
        } finally {
            UIManager.setButtonLoading(target, false);
        }
        return;
    }

    // Load subreddit posts
    if (target.id === 'loadSubredditBtn') {
        e.preventDefault();
        const subreddit = document.getElementById('subredditInput').value.trim().replace(/^r\//, '');
        const sort = document.getElementById('sortFilter').value;
        
        if (!subreddit) {
            showToast('Please enter a subreddit name', 'error');
            return;
        }

        if (!appState.isAuthenticated) {
            showToast('Please authenticate with Reddit first', 'error');
            return;
        }

        try {
            UIManager.setButtonLoading(target, true);
            await DataManager.loadSubredditPosts(subreddit, sort);
        } catch (error) {
            showToast(`Failed to load posts: ${error.message}`, 'error');
        } finally {
            UIManager.setButtonLoading(target, false);
        }
        return;
    }

    // Generate comments
    if (target.id === 'generateCommentsBtn') {
        e.preventDefault();
        const postUrl = document.getElementById('postUrlInput').value.trim();
        const tone = document.getElementById('commentTone').value;
        
        if (!postUrl) {
            showToast('Please enter a post URL or ID', 'error');
            return;
        }

        if (!appState.getGeminiKey()) {
            showToast('Please configure Gemini API key first', 'error');
            return;
        }

        try {
            UIManager.setButtonLoading(target, true);
            await DataManager.generateCommentsForPost(postUrl, tone);
        } catch (error) {
            showToast(`Failed to generate comments: ${error.message}`, 'error');
        } finally {
            UIManager.setButtonLoading(target, false);
        }
        return;
    }

    // Generate content
    if (target.id === 'generateContentBtn') {
        e.preventDefault();
        const subreddit = document.getElementById('targetSubreddit').value.trim();
        const title = document.getElementById('postTitle').value.trim();
        
        if (!subreddit) {
            showToast('Please specify a target subreddit', 'error');
            return;
        }

        if (!appState.getGeminiKey()) {
            showToast('Please configure Gemini API key first', 'error');
            return;
        }

        try {
            UIManager.setButtonLoading(target, true);
            const topic = title || 'interesting topic for this community';
            const postType = document.getElementById('postType').value;
            
            const generatedContent = await geminiAPI.generatePost(subreddit, topic, postType);
            
            // Parse the generated content
            const lines = generatedContent.split('\n');
            let newTitle = '';
            let newContent = '';
            
            for (const line of lines) {
                if (line.startsWith('TITLE:')) {
                    newTitle = line.replace('TITLE:', '').trim();
                } else if (line.startsWith('CONTENT:')) {
                    newContent = line.replace('CONTENT:', '').trim();
                } else if (newContent) {
                    newContent += '\n' + line;
                }
            }
            
            if (newTitle) document.getElementById('postTitle').value = newTitle;
            if (newContent && postType === 'self') {
                document.getElementById('postContent').value = newContent.trim();
            }
            
            showToast('Content generated successfully!', 'success');
        } catch (error) {
            showToast(`Failed to generate content: ${error.message}`, 'error');
        } finally {
            UIManager.setButtonLoading(target, false);
        }
        return;
    }

    // Refresh karma
    if (target.id === 'refreshKarma') {
        e.preventDefault();
        if (!appState.isAuthenticated) {
            showToast('Please authenticate first', 'error');
            return;
        }

        try {
            UIManager.setButtonLoading(target, true);
            await DataManager.updateKarma();
            showToast('Karma updated!', 'success');
        } catch (error) {
            showToast(`Failed to update karma: ${error.message}`, 'error');
        } finally {
            UIManager.setButtonLoading(target, false);
        }
        return;
    }

    // Copy to clipboard buttons
    if (target.classList.contains('copy-comment-btn')) {
        e.preventDefault();
        const comment = target.dataset.comment;
        UIManager.copyToClipboard(comment);
        return;
    }

    // Modal controls
    if (target.classList.contains('modal-close') || target.classList.contains('modal-overlay')) {
        e.preventDefault();
        UIManager.hideModals();
        return;
    }
});

// Form submission handling
document.addEventListener('submit', function(e) {
    if (e.target.id === 'redditAuthForm') {
        e.preventDefault();
        // Authentication is handled by click event above
    }
});

// Form field changes
document.addEventListener('change', function(e) {
    const target = e.target;
    
    // Post type change
    if (target.id === 'postType') {
        UIManager.togglePostTypeFields(target.value);
    }
    
    // Sort filter change
    if (target.id === 'sortFilter') {
        const timeFilter = document.getElementById('timeFilter');
        if (timeFilter) {
            timeFilter.style.display = target.value === 'top' ? 'block' : 'none';
        }
    }
});

console.log('Reddit Assistant Pro loaded successfully!');
console.log('🔴 This version connects to REAL Reddit and Gemini APIs');
console.log('⚠️ Make sure you have valid API credentials configured');