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
    return res.status(500).json({ error: 'KV not configured' });
  }

  // Upstash REST API 호출 함수
  const kvGet = async (key) => {
    const response = await fetch(`${KV_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    const data = await response.json();
    if (data.result) {
      return JSON.parse(data.result);
    }
    return null;
  };

  const kvSet = async (key, value) => {
    const response = await fetch(`${KV_URL}/set/${key}`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(JSON.stringify(value)),
    });
    return response.ok;
  };

  try {
    const { boardId = 'public' } = req.query;
    const boardKey = `board:${boardId}`;

    // GET - 보드 데이터 가져오기
    if (req.method === 'GET') {
      const data = await kvGet(boardKey);
      return res.status(200).json({
        boardId,
        references: data?.references || [],
        customCategories: data?.customCategories || {},
        createdAt: data?.createdAt || null,
      });
    }

    // POST - 새 레퍼런스 추가
    if (req.method === 'POST') {
      const { reference } = req.body;
      
      if (!reference) {
        return res.status(400).json({ error: 'Reference data required' });
      }

      const data = await kvGet(boardKey) || { 
        references: [], 
        customCategories: {},
        createdAt: new Date().toISOString()
      };
      
      const newRef = {
        ...reference,
        id: Date.now(),
        addedAt: new Date().toLocaleDateString('ko-KR'),
      };
      
      data.references.unshift(newRef);
      await kvSet(boardKey, data);
      
      return res.status(201).json({ success: true, reference: newRef });
    }

    // PUT - 레퍼런스 수정
    if (req.method === 'PUT') {
      const { reference } = req.body;
      
      if (!reference || !reference.id) {
        return res.status(400).json({ error: 'Reference with ID required' });
      }

      const data = await kvGet(boardKey);
      if (!data) {
        return res.status(404).json({ error: 'Board not found' });
      }

      const index = data.references.findIndex(r => r.id === reference.id);
      if (index === -1) {
        return res.status(404).json({ error: 'Reference not found' });
      }

      data.references[index] = reference;
      await kvSet(boardKey, data);
      
      return res.status(200).json({ success: true, reference });
    }

    // DELETE - 레퍼런스 삭제
    if (req.method === 'DELETE') {
      const { referenceId } = req.body;
      
      if (!referenceId) {
        return res.status(400).json({ error: 'Reference ID required' });
      }

      const data = await kvGet(boardKey);
      if (!data) {
        return res.status(404).json({ error: 'Board not found' });
      }

      data.references = data.references.filter(r => r.id !== referenceId);
      await kvSet(boardKey, data);
      
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Board API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
