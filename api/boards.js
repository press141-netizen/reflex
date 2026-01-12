import { createClient } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const { boardId = 'public' } = req.query;
    const boardKey = `board:${boardId}`;

    // GET - 보드 데이터 가져오기
    if (req.method === 'GET') {
      const data = await kv.get(boardKey);
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

      const data = await kv.get(boardKey) || { 
        references: [], 
        customCategories: {},
        createdAt: new Date().toISOString()
      };
      
      // 새 레퍼런스에 ID와 날짜 추가
      const newRef = {
        ...reference,
        id: Date.now(),
        addedAt: new Date().toLocaleDateString('ko-KR'),
      };
      
      data.references.unshift(newRef);
      await kv.set(boardKey, data);
      
      return res.status(201).json({ success: true, reference: newRef });
    }

    // PUT - 레퍼런스 수정
    if (req.method === 'PUT') {
      const { reference } = req.body;
      
      if (!reference || !reference.id) {
        return res.status(400).json({ error: 'Reference with ID required' });
      }

      const data = await kv.get(boardKey);
      if (!data) {
        return res.status(404).json({ error: 'Board not found' });
      }

      const index = data.references.findIndex(r => r.id === reference.id);
      if (index === -1) {
        return res.status(404).json({ error: 'Reference not found' });
      }

      data.references[index] = reference;
      await kv.set(boardKey, data);
      
      return res.status(200).json({ success: true, reference });
    }

    // DELETE - 레퍼런스 삭제
    if (req.method === 'DELETE') {
      const { referenceId } = req.body;
      
      if (!referenceId) {
        return res.status(400).json({ error: 'Reference ID required' });
      }

      const data = await kv.get(boardKey);
      if (!data) {
        return res.status(404).json({ error: 'Board not found' });
      }

      data.references = data.references.filter(r => r.id !== referenceId);
      await kv.set(boardKey, data);
      
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Board API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
