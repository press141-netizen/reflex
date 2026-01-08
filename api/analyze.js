export const config = {
  maxDuration: 60, // 60초 타임아웃
};

export default async function handler(req, res) {
  // CORS
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
    const { image, componentName, mimeType, imageWidth, imageHeight } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const width = imageWidth || 400;
    const height = imageHeight || 300;
    const mime = mimeType || 'image/png';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
            { type: 'text', text: `Generate Figma code for this UI. Size: ${width}x${height}px.

Return ONLY JavaScript:

(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const frame = figma.createFrame();
  frame.name = "${componentName || 'Frame'}";
  frame.resize(${width}, ${height});
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  frame.layoutMode = "VERTICAL";
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 12;
  frame.itemSpacing = 8;
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
  
  // Add elements here
  
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();

Rules:
- NO markdown, code only
- Use figma.createFrame() for containers
- Use figma.createText() for text (set fontName before characters)
- Match colors from image
- Use "FIXED" or "AUTO" for sizing (never "FILL_CONTAINER")` }
          ],
        }],
      }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'API failed' });
    }

    const data = await response.json();
    let code = data.content?.[0]?.text || '';
    code = code.replace(/```javascript\n?/gi, '').replace(/```js\n?/gi, '').replace(/```\n?/g, '').trim();

    return res.status(200).json({ success: true, figmaCode: code });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
