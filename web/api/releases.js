/**
 * Vercel serverless function — proxies GitHub releases API.
 * Uses the public taxwise-releases repo — no token required.
 */
export default async function handler(req, res) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'taxwise-website',
  };

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
