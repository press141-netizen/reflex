export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'Storage not configured' });
  }

  const redis = async (cmd) => {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cmd),
    });
    const d = await r.json();
    return d.result;
  };

  const { boardId = 'public' } = req.query;
  // public은 기존 main 키 사용 (데이터 호환)
  const BOARD_KEY = boardId === 'public' ? 'reflex:main' : `reflex:${boardId}`;

  try {
    const { customCategories } = req.body;
    if (!customCategories) return res.status(400).json({ error: 'No categories' });

    const raw = await redis(['GET', BOARD_KEY]);
    const data = raw ? JSON.parse(raw) : { references: [], customCategories: {} };
    
    data.customCategories = customCategories;
    await redis(['SET', BOARD_KEY, JSON.stringify(data)]);
    
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Categories API Error:', e);
    return res.status(500).json({ error: e.message });
  }
}
