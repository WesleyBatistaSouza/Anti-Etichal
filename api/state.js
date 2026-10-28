const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});
const KEY = 'anti-ethical:state';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const pass = process.env.SYNC_PASSWORD;
  if (!pass) return res.status(500).json({ error: 'SYNC_PASSWORD não configurada' });
  if (req.headers['x-sync-key'] !== pass) return res.status(401).json({ error: 'unauthorized' });
  try {
    const cur = (await redis.get(KEY)) || { rev: 0, data: null };
    if (req.method === 'GET') return res.status(200).json(cur);
    if (req.method === 'PUT') {
      const { rev, data } = req.body || {};
      if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.journal)) {
        return res.status(400).json({ error: 'invalid' });
      }
      if (rev !== cur.rev) return res.status(409).json(cur);
      const next = { rev: cur.rev + 1, data };
      await redis.set(KEY, next);
      return res.status(200).json({ rev: next.rev });
    }
    return res.status(405).json({ error: 'method' });
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
