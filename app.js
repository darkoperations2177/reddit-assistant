async authenticateUser() {
    console.log('Starting Vercel OAuth authentication...');
    
    const clientIdEl = document.getElementById('clientId');
    const clientSecretEl = document.getElementById('clientSecret');
    
    if (!clientIdEl || !clientSecretEl) {
        this.showToast('Form elements not found', 'error');
        return;
    }

    const clientId = clientIdEl.value.trim();
    const clientSecret = clientSecretEl.value.trim();
    
    if (!clientId || !clientSecret) {
        this.showToast('Please enter Client ID and Secret', 'error');
        return;
    }

    // Store credentials for OAuth callback
    localStorage.setItem('reddit_oauth_credentials', JSON.stringify({
        clientId: clientId,
        clientSecret: clientSecret
    }));

    // Generate OAuth URL
    const redirectUri = `${window.location.origin}/auth/callback`;
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('oauth_state', state);
    
    const oauthUrl = `https://www.reddit.com/api/v1/authorize?` + 
        `client_id=${clientId}&` +
        `response_type=code&` +
        `state=${state}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `duration=permanent&` +
        `scope=identity read submit edit history`;

    // Redirect to Reddit OAuth
    this.showToast('Redirecting to Reddit for authentication...', 'info');
    window.location.href = oauthUrl;
}
