// api/me.js
export default async function handler(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const apiRes = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'RedditAutoAssistant:v1.0 (by /u/YourUsername)'
      }
    });
    const data = await apiRes.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(apiRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
