export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

  // boardId 파라미터 (기본값: public)
  let { boardId = 'public' } = req.query;

  // Sanitize boardId to prevent NoSQL injection
  boardId = String(boardId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  if (!boardId) boardId = 'public';

  // public은 기존 main 키 사용 (데이터 호환)
  const BOARD_KEY = boardId === 'public' ? 'reflex:main' : `reflex:${boardId}`;

  try {
    // GET - 데이터 로드
    if (req.method === 'GET') {
      const raw = await redis(['GET', BOARD_KEY]);
      if (raw) {
        const data = JSON.parse(raw);
        return res.status(200).json(data);
      }
      return res.status(200).json({ references: [], customCategories: {} });
    }

    // POST - 새 레퍼런스 추가
    if (req.method === 'POST') {
      const { reference } = req.body;
      if (!reference) return res.status(400).json({ error: 'No reference' });

      // Validate reference object size
      const referenceSize = JSON.stringify(reference).length;
      if (referenceSize > 1000000) { // 1MB limit
        return res.status(400).json({ error: 'Reference too large (max 1MB)' });
      }

      const raw = await redis(['GET', BOARD_KEY]);
      const data = raw ? JSON.parse(raw) : { references: [], customCategories: {} };

      // Limit total number of references
      if (data.references.length >= 10000) {
        return res.status(400).json({ error: 'Maximum references limit reached (10000)' });
      }

      const newRef = { ...reference, id: Date.now() };
      data.references.unshift(newRef);

      await redis(['SET', BOARD_KEY, JSON.stringify(data)]);
      return res.status(201).json({ success: true, reference: newRef });
    }

    // PUT - 레퍼런스 수정
    if (req.method === 'PUT') {
      const { reference } = req.body;
      if (!reference?.id) return res.status(400).json({ error: 'No reference ID' });

      const raw = await redis(['GET', BOARD_KEY]);
      if (!raw) return res.status(404).json({ error: 'Not found' });
      
      const data = JSON.parse(raw);
      const idx = data.references.findIndex(r => r.id === reference.id);
      if (idx === -1) return res.status(404).json({ error: 'Reference not found' });
      
      data.references[idx] = reference;
      await redis(['SET', BOARD_KEY, JSON.stringify(data)]);
      return res.status(200).json({ success: true });
    }

    // DELETE - 레퍼런스 삭제
    if (req.method === 'DELETE') {
      const { referenceId } = req.body;
      if (!referenceId) return res.status(400).json({ error: 'No ID' });

      const raw = await redis(['GET', BOARD_KEY]);
      if (!raw) return res.status(404).json({ error: 'Not found' });
      
      const data = JSON.parse(raw);
      data.references = data.references.filter(r => r.id !== referenceId);
      await redis(['SET', BOARD_KEY, JSON.stringify(data)]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('API Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
