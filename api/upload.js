export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

  if (!BLOB_TOKEN) {
    return res.status(500).json({ error: 'Blob storage not configured' });
  }

  try {
    const { image, contentType } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data required' });
    }

    // Base64 디코딩
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 파일명 생성
    const ext = contentType?.split('/')[1] || 'png';
    const filename = `reflex-${Date.now()}.${ext}`;

    // Vercel Blob API 직접 호출
    const response = await fetch(`https://blob.vercel-storage.com/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${BLOB_TOKEN}`,
        'Content-Type': contentType || 'image/png',
        'x-api-version': '7',
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Blob upload error:', errorText);
      return res.status(500).json({ error: 'Upload failed', details: errorText });
    }

    const blob = await response.json();

    return res.status(200).json({ 
      success: true, 
      url: blob.url,
      filename: filename,
    });

  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
