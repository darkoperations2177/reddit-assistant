// Sample data from the provided JSON
const sampleData = {
  posts: [
    {
      id: "1",
      title: "What's the best programming language to learn in 2025?",
      subreddit: "r/learnprogramming",
      author: "u/codingBeginner",
      upvotes: 245,
      comments: 67,
      content: "I'm just starting my programming journey and want to know which language would give me the best opportunities in 2025...",
      timeAgo: "3 hours ago"
    },
    {
      id: "2", 
      title: "My dog learned a new trick today!",
      subreddit: "r/aww",
      author: "u/dogLover123",
      upvotes: 1203,
      comments: 89,
      content: "After weeks of training, my golden retriever finally learned how to fetch my slippers...",
      timeAgo: "1 hour ago"
    },
    {
      id: "3",
      title: "LPT: Use a tennis ball to massage sore muscles",
      subreddit: "r/LifeProTips",
      author: "u/healthyLiving",
      upvotes: 892,
      comments: 34,
      content: "Place a tennis ball between your back and the wall, then lean into it to work out knots...",
      timeAgo: "5 hours ago"
    }
  ],
  commentSuggestions: [
    {
      tone: "helpful",
      text: "Based on current market trends, I'd recommend starting with Python or JavaScript. Python is great for beginners and has applications in web development, data science, and AI. JavaScript is essential for web development and has a huge job market."
    },
    {
      tone: "funny", 
      text: "Obviously the answer is HTML - it's a programming language, right? 😄 But seriously, Python is probably your best bet for 2025!"
    },
    {
      tone: "informative",
      text: "Here are the top languages by job demand in 2025: 1) Python (AI/ML boom), 2) JavaScript (web development), 3) TypeScript (enterprise apps), 4) Go (cloud/backend), 5) Rust (systems programming). Choose based on your interests!"
    }
  ],
  karmaStats: {
    totalKarma: 15847,
    postKarma: 8934,
    commentKarma: 6913,
    monthlyGrowth: "+1,234",
    weeklyGrowth: "+287"
  },
  scheduledPosts: [
    {
      id: "sp1",
      title: "Weekly Discussion: Favorite Productivity Apps",
      subreddit: "r/productivity",
      type: "text",
      scheduledTime: "2025-09-06 09:00",
      status: "pending"
    },
    {
      id: "sp2", 
      title: "Tutorial: Setting up a Home Lab for Learning",
      subreddit: "r/homelab",
      type: "text",
      scheduledTime: "2025-09-06 15:00",
      status: "pending"
    }
  ],
  topSubreddits: [
    {name: "r/AskReddit", members: "45.2M", activity: "Very High"},
    {name: "r/learnprogramming", members: "4.2M", activity: "High"},
    {name: "r/LifeProTips", members: "22.1M", activity: "High"},
    {name: "r/explainlikeimfive", members: "20.8M", activity: "Medium"},
    {name: "r/technology", members: "14.2M", activity: "High"}
  ],
  recentActivity: [
    {type: "comment", subreddit: "r/webdev", content: "Great tutorial! This helped me understand React hooks better.", karma: "+23", timeAgo: "2 hours ago"},
    {type: "post", subreddit: "r/programming", content: "How I automated my deployment pipeline", karma: "+156", timeAgo: "1 day ago"},
    {type: "comment", subreddit: "r/AskReddit", content: "This happened to me too! Thanks for sharing your story.", karma: "+67", timeAgo: "2 days ago"}
  ]
};

// Global state
let currentTab = 'setup';
let isAuthenticated = false;
let karmaChart = null;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing app...');
  
  try {
    initializeApp();
    setupEventListeners();
    populateData();
    loadSavedSettings();
    console.log('App initialized successfully');
  } catch (error) {
    console.error('Error initializing app:', error);
  }
});

function initializeApp() {
  // Check if user has saved credentials
  const savedCredentials = localStorage.getItem('redditCredentials');
  if (savedCredentials) {
    isAuthenticated = true;
    showAuthenticatedState();
  }
  
  // Set theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-color-scheme', savedTheme);
  updateThemeToggle(savedTheme);
}

function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // Tab navigation
  const navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Tab clicked:', tab.dataset.tab);
      switchTab(tab.dataset.tab);
    });
  });

  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function(e) {
      e.preventDefault();
      toggleTheme();
    });
  }

  // Authentication buttons
  const testConnectionBtn = document.getElementById('testConnection');
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', function(e) {
      e.preventDefault();
      testConnection();
    });
  }

  const saveCredentialsBtn = document.getElementById('saveCredentials');
  if (saveCredentialsBtn) {
    saveCredentialsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      saveCredentials();
    });
  }

  // Auto-posting buttons
  const generateContentBtn = document.getElementById('generateContent');
  if (generateContentBtn) {
    generateContentBtn.addEventListener('click', function(e) {
      e.preventDefault();
      generateContent();
    });
  }

  const schedulePostBtn = document.getElementById('schedulePost');
  if (schedulePostBtn) {
    schedulePostBtn.addEventListener('click', function(e) {
      e.preventDefault();
      showScheduleModal();
    });
  }

  const confirmScheduleBtn = document.getElementById('confirmSchedule');
  if (confirmScheduleBtn) {
    confirmScheduleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      confirmSchedule();
    });
  }

  // Modal controls
  document.querySelectorAll('.modal-close, .modal-overlay').forEach(element => {
    element.addEventListener('click', function(e) {
      e.preventDefault();
      closeModals();
    });
  });

  // Prevent modal close when clicking inside modal content
  document.querySelectorAll('.modal-content').forEach(content => {
    content.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  });

  // Subreddit filter
  const subredditFilter = document.getElementById('subredditFilter');
  if (subredditFilter) {
    subredditFilter.addEventListener('change', function(e) {
      filterPostsBySubreddit(e.target.value);
    });
  }

  // Delegated event listeners for dynamic content
  document.addEventListener('click', function(e) {
    // Comment suggestion buttons
    if (e.target.classList.contains('suggest-comment-btn')) {
      e.preventDefault();
      const postId = e.target.dataset.postId;
      showCommentModal(postId);
    }

    // Post comment buttons
    if (e.target.classList.contains('post-comment-btn')) {
      e.preventDefault();
      const suggestionText = e.target.dataset.suggestion;
      postComment(suggestionText);
    }

    // Scheduled post actions
    if (e.target.classList.contains('edit-post-btn')) {
      e.preventDefault();
      const postId = e.target.dataset.postId;
      editScheduledPost(postId);
    }

    if (e.target.classList.contains('delete-post-btn')) {
      e.preventDefault();
      const postId = e.target.dataset.postId;
      deleteScheduledPost(postId);
    }
  });

  // Settings auto-save
  document.addEventListener('change', function(e) {
    if (e.target.closest('#settings')) {
      saveSettings();
    }
  });

  console.log('Event listeners setup complete');
}

function switchTab(tabName) {
  console.log('Switching to tab:', tabName);
  
  // Update nav tabs
  const navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab contents
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === tabName);
  });

  currentTab = tabName;

  // Initialize tab-specific functionality
  if (tabName === 'karma' && !karmaChart) {
    setTimeout(() => initializeKarmaChart(), 100);
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-color-scheme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-color-scheme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeToggle(newTheme);
  
  showToast(`Switched to ${newTheme} theme`, 'success');
}

function updateThemeToggle(theme) {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  }
}

function testConnection() {
  const clientId = document.getElementById('clientId').value;
  const clientSecret = document.getElementById('clientSecret').value;
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (!clientId || !clientSecret || !username || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  showToast('Testing connection...', 'info');
  
  setTimeout(() => {
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
      connectionStatus.classList.remove('hidden');
    }
    showToast('Connection successful!', 'success');
  }, 1500);
}

function saveCredentials() {
  const credentials = {
    clientId: document.getElementById('clientId').value,
    clientSecret: document.getElementById('clientSecret').value,
    username: document.getElementById('username').value,
    password: document.getElementById('password').value
  };

  if (!credentials.clientId || !credentials.clientSecret || !credentials.username || !credentials.password) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  localStorage.setItem('redditCredentials', JSON.stringify(credentials));
  isAuthenticated = true;
  showAuthenticatedState();
  showToast('Credentials saved successfully!', 'success');
  
  // Switch to dashboard after a short delay
  setTimeout(() => switchTab('dashboard'), 1000);
}

function showAuthenticatedState() {
  const connectionStatus = document.getElementById('connectionStatus');
  if (connectionStatus) {
    connectionStatus.classList.remove('hidden');
  }
}

function populateData() {
  try {
    populateActivityTimeline();
    populatePosts();
    populateScheduledPosts();
    populateBestSubreddits();
  } catch (error) {
    console.error('Error populating data:', error);
  }
}

function populateActivityTimeline() {
  const timeline = document.getElementById('activityTimeline');
  if (timeline) {
    timeline.innerHTML = sampleData.recentActivity.map(activity => `
      <div class="activity-item">
        <div class="activity-icon">${activity.type === 'post' ? '📝' : '💬'}</div>
        <div class="activity-content">
          <div class="activity-meta">${activity.subreddit} • ${activity.timeAgo}</div>
          <div class="activity-text">${activity.content}</div>
          <div class="activity-karma">${activity.karma} karma</div>
        </div>
      </div>
    `).join('');
  }
}

function populatePosts() {
  const container = document.getElementById('postsContainer');
  if (container) {
    container.innerHTML = sampleData.posts.map(post => `
      <div class="post-card" data-subreddit="${post.subreddit}">
        <div class="post-header">
          <div>
            <h3 class="post-title">${post.title}</h3>
            <div class="post-meta">
              <span class="subreddit">${post.subreddit}</span> • 
              <span class="author">${post.author}</span> • 
              <span class="time">${post.timeAgo}</span>
            </div>
          </div>
        </div>
        <div class="post-content">${post.content}</div>
        <div class="post-stats">
          <div class="post-stat">
            <span>⬆️</span>
            <span>${post.upvotes}</span>
          </div>
          <div class="post-stat">
            <span>💬</span>
            <span>${post.comments}</span>
          </div>
        </div>
        <div class="post-actions">
          <button class="btn btn--primary btn--sm suggest-comment-btn" data-post-id="${post.id}">
            🤖 Suggest Comment
          </button>
        </div>
      </div>
    `).join('');
  }
}

function populateScheduledPosts() {
  const container = document.getElementById('scheduledPosts');
  if (container) {
    container.innerHTML = sampleData.scheduledPosts.map(post => `
      <div class="scheduled-post-item">
        <div class="scheduled-post-header">
          <h4 class="scheduled-post-title">${post.title}</h4>
          <div class="scheduled-post-actions">
            <button class="btn btn--sm btn--secondary edit-post-btn" data-post-id="${post.id}">Edit</button>
            <button class="btn btn--sm btn--outline delete-post-btn" data-post-id="${post.id}">Delete</button>
          </div>
        </div>
        <div class="scheduled-post-meta">${post.subreddit} • ${post.type} post</div>
        <div class="scheduled-post-time">📅 ${formatDateTime(post.scheduledTime)}</div>
      </div>
    `).join('');
  }
}

function populateBestSubreddits() {
  const container = document.getElementById('bestSubreddits');
  if (container) {
    container.innerHTML = sampleData.topSubreddits.map(subreddit => `
      <div class="subreddit-item">
        <div>
          <div class="subreddit-name">${subreddit.name}</div>
          <div class="subreddit-members">${subreddit.members} members</div>
        </div>
        <div class="subreddit-activity activity-${subreddit.activity.toLowerCase().replace(/\s+/g, '-')}">${subreddit.activity}</div>
      </div>
    `).join('');
  }
}

function showCommentModal(postId) {
  const post = sampleData.posts.find(p => p.id === postId);
  if (!post) return;

  const modal = document.getElementById('commentModal');
  const postPreview = document.getElementById('modalPostPreview');
  const suggestionsContainer = document.getElementById('commentSuggestions');

  if (postPreview) {
    postPreview.innerHTML = `
      <h4>${post.title}</h4>
      <div class="post-meta">
        <span class="subreddit">${post.subreddit}</span> • 
        <span class="author">${post.author}</span>
      </div>
      <p>${post.content}</p>
    `;
  }

  if (suggestionsContainer) {
    suggestionsContainer.innerHTML = sampleData.commentSuggestions.map(suggestion => `
      <div class="suggestion-item">
        <div class="suggestion-header">
          <span class="suggestion-tone">${suggestion.tone}</span>
          <button class="btn btn--primary btn--sm post-comment-btn" data-suggestion="${suggestion.text}">
            Post Comment
          </button>
        </div>
        <div class="suggestion-text">${suggestion.text}</div>
      </div>
    `).join('');
  }

  if (modal) {
    modal.classList.remove('hidden');
  }
}

function generateContent() {
  const titleField = document.getElementById('postTitle');
  const contentField = document.getElementById('postContent');

  showToast('Generating content with AI...', 'info');

  setTimeout(() => {
    const titles = [
      "Weekly Discussion: Best Practices in Modern Development",
      "Tutorial: Building Your First Docker Container",
      "Guide: Setting Up a Productive Home Office",
      "Tips for Managing Remote Teams Effectively"
    ];
    
    const contents = [
      "Let's discuss the most important practices that every developer should follow in 2025. What are your thoughts on code reviews, testing strategies, and documentation?",
      "In this comprehensive guide, I'll walk you through creating your first Docker container from scratch. We'll cover the basics and some advanced tips.",
      "Working from home has become the norm. Here are some proven strategies for creating a productive workspace that enhances your focus and creativity.",
      "Managing remote teams comes with unique challenges. Here are some practical tips based on my experience leading distributed teams."
    ];

    if (titleField && !titleField.value) {
      titleField.value = titles[Math.floor(Math.random() * titles.length)];
    }
    
    if (contentField && !contentField.value) {
      contentField.value = contents[Math.floor(Math.random() * contents.length)];
    }

    showToast('Content generated successfully!', 'success');
  }, 2000);
}

function showScheduleModal() {
  const title = document.getElementById('postTitle').value;
  const content = document.getElementById('postContent').value;

  if (!title || !content) {
    showToast('Please fill in title and content first', 'error');
    return;
  }

  const modal = document.getElementById('scheduleModal');
  const dateInput = document.getElementById('scheduleDateTime');
  
  if (dateInput) {
    // Set default date to current time + 1 hour
    const now = new Date();
    now.setHours(now.getHours() + 1);
    dateInput.value = now.toISOString().slice(0, 16);
  }

  if (modal) {
    modal.classList.remove('hidden');
  }
}

function confirmSchedule() {
  const title = document.getElementById('postTitle').value;
  const subreddit = document.getElementById('targetSubreddit').value;
  const content = document.getElementById('postContent').value;
  const scheduleTime = document.getElementById('scheduleDateTime').value;
  const frequency = document.getElementById('repeatFrequency').value;

  if (!scheduleTime) {
    showToast('Please select a schedule time', 'error');
    return;
  }

  // Add to scheduled posts
  const newPost = {
    id: 'sp' + Date.now(),
    title,
    subreddit,
    type: 'text',
    scheduledTime: scheduleTime,
    status: 'pending',
    frequency
  };

  sampleData.scheduledPosts.push(newPost);
  populateScheduledPosts();

  // Clear form
  const form = document.getElementById('createPostForm');
  if (form) {
    form.reset();
  }
  
  closeModals();
  showToast('Post scheduled successfully!', 'success');
}

function postComment(suggestionText) {
  showToast('Posting comment...', 'info');
  
  setTimeout(() => {
    showToast('Comment posted successfully!', 'success');
    closeModals();
    
    // Add to recent activity
    sampleData.recentActivity.unshift({
      type: 'comment',
      subreddit: 'r/learnprogramming',
      content: suggestionText.substring(0, 50) + '...',
      karma: '+' + Math.floor(Math.random() * 20 + 1),
      timeAgo: 'just now'
    });
    
    populateActivityTimeline();
  }, 1500);
}

function editScheduledPost(postId) {
  const post = sampleData.scheduledPosts.find(p => p.id === postId);
  if (!post) return;

  const titleField = document.getElementById('postTitle');
  const subredditField = document.getElementById('targetSubreddit');

  if (titleField) titleField.value = post.title;
  if (subredditField) subredditField.value = post.subreddit;
  
  showToast('Post loaded for editing', 'info');
  switchTab('posting');
}

function deleteScheduledPost(postId) {
  if (confirm('Are you sure you want to delete this scheduled post?')) {
    sampleData.scheduledPosts = sampleData.scheduledPosts.filter(p => p.id !== postId);
    populateScheduledPosts();
    showToast('Scheduled post deleted', 'success');
  }
}

function initializeKarmaChart() {
  const canvas = document.getElementById('karmaChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    datasets: [
      {
        label: 'Post Karma',
        data: [1200, 1900, 3000, 5000, 6200, 7100, 7800, 8500, 8934],
        borderColor: '#1FB8CD',
        backgroundColor: 'rgba(31, 184, 205, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Comment Karma',
        data: [800, 1500, 2200, 3100, 4200, 5000, 5800, 6300, 6913],
        borderColor: '#FFC185',
        backgroundColor: 'rgba(255, 193, 133, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  karmaChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Karma Growth Over Time'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString();
            }
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });
}

function filterPostsBySubreddit(selectedSubreddit) {
  const posts = document.querySelectorAll('.post-card');
  
  posts.forEach(post => {
    const subredditElement = post.querySelector('.subreddit');
    if (selectedSubreddit === 'all' || (subredditElement && subredditElement.textContent === selectedSubreddit)) {
      post.style.display = 'block';
    } else {
      post.style.display = 'none';
    }
  });
}

function closeModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.add('hidden');
  });
}

function saveSettings() {
  const settings = {};
  const settingsElements = document.querySelectorAll('#settings input, #settings select, #settings textarea');
  
  settingsElements.forEach(input => {
    if (input.type === 'checkbox') {
      settings[input.id] = input.checked;
    } else {
      settings[input.id] = input.value;
    }
  });
  
  localStorage.setItem('redditAssistantSettings', JSON.stringify(settings));
  showToast('Settings saved automatically', 'success');
}

function loadSavedSettings() {
  const savedSettings = localStorage.getItem('redditAssistantSettings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    
    Object.keys(settings).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = settings[key];
        } else {
          element.value = settings[key];
        }
      }
    });
  }
}

function showToast(message, type = 'info') {
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
    <div class="toast-message">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 4000);
}

function formatDateTime(dateTimeString) {
  const date = new Date(dateTimeString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Simulate real-time karma updates
setInterval(() => {
  const karmaElement = document.getElementById('totalKarma');
  if (karmaElement && Math.random() < 0.1) {
    let currentKarma = parseInt(karmaElement.textContent.replace(/,/g, ''));
    currentKarma += Math.floor(Math.random() * 10) + 1;
    karmaElement.textContent = currentKarma.toLocaleString();
  }
}, 10000);