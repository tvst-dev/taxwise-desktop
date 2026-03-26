/**
 * Vercel serverless function — proxies GitHub releases API.
 * Keeps the GitHub repo private while exposing release info to the public website.
 * Set GITHUB_TOKEN in Vercel environment variables (Settings → Environment Variables).
 */
export default async function handler(req, res) {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'taxwise-website',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const r = await fetch(
      'https://api.github.com/repos/tvst-dev/taxwise-desktop/releases?per_page=10',
      { headers }
    );
    const data = await r.json();

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
