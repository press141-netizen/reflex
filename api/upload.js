import { put } from '@vercel/blob';

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

  try {
    const { image, filename, contentType } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data required' });
    }

    // Base64 디코딩
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 파일명 생성
    const ext = contentType?.split('/')[1] || 'png';
    const name = filename || `image-${Date.now()}.${ext}`;

    // Vercel Blob에 업로드
    const blob = await put(name, buffer, {
      access: 'public',
      contentType: contentType || 'image/png',
    });

    return res.status(200).json({ 
      success: true, 
      url: blob.url,
      filename: name,
    });

  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
