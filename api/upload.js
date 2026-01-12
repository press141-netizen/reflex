export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, contentType } = req.body;
  if (!image) return res.status(400).json({ error: 'No image' });

  const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

  // Blob 토큰 없으면 base64 그대로 반환
  if (!BLOB_TOKEN) {
    return res.status(200).json({ success: true, url: image });
  }

  try {
    const base64 = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const ext = contentType?.split('/')[1] || 'png';
    const filename = `reflex/${Date.now()}.${ext}`;

    const r = await fetch(`https://blob.vercel-storage.com/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${BLOB_TOKEN}`,
        'Content-Type': contentType || 'image/png',
        'x-api-version': '7',
      },
      body: buffer,
    });

    if (!r.ok) {
      // 업로드 실패시 base64 그대로 반환
      return res.status(200).json({ success: true, url: image });
    }

    const blob = await r.json();
    return res.status(200).json({ success: true, url: blob.url });
  } catch (e) {
    // 에러시 base64 그대로 반환
    return res.status(200).json({ success: true, url: image });
  }
}
