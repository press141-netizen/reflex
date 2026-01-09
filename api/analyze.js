export const config = {
  maxDuration: 60,
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
    const { image, componentName, mimeType, imageWidth, imageHeight, imageNote, tags } = req.body;

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
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
            {
              type: 'text', text: `Generate Figma Plugin API code for this UI (${width}x${height}px).
${imageNote || tags?.length > 0 ? `
CONTEXT:
${imageNote ? `- Description: ${imageNote}` : ''}${imageNote && tags?.length > 0 ? '\n' : ''}${tags?.length > 0 ? `- Tags: ${tags.join(', ')}` : ''}
` : ''}
RULES:
- Return ONLY JavaScript code, no markdown
- Use helpers: txt(), box(), container() as shown below
- Charts/graphs = single placeholder rectangle
- Icons = small colored rectangles
- MUST end with figma.currentPage.appendChild() and figma.viewport.scrollAndZoomIntoView()
- All frames with fixed size need: primaryAxisSizingMode = "FIXED"; counterAxisSizingMode = "FIXED";

START CODE:
(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  
  const txt = (p, s, sz, c, st = "Regular") => { const t = figma.createText(); t.fontName = { family: "Inter", style: st }; t.characters = s; t.fontSize = sz; t.fills = [{ type: 'SOLID', color: c }]; p.appendChild(t); return t; };
  const box = (p, w, h, c, r = 0) => { const b = figma.createRectangle(); b.resize(w, h); b.fills = [{ type: 'SOLID', color: c }]; b.cornerRadius = r; p.appendChild(b); return b; };
  const row = (p, gap) => { const f = figma.createFrame(); f.layoutMode = "HORIZONTAL"; f.itemSpacing = gap; f.fills = []; f.counterAxisAlignItems = "CENTER"; f.primaryAxisSizingMode = "AUTO"; f.counterAxisSizingMode = "AUTO"; if(p) p.appendChild(f); return f; };
  const col = (p, gap) => { const f = figma.createFrame(); f.layoutMode = "VERTICAL"; f.itemSpacing = gap; f.fills = []; f.primaryAxisSizingMode = "AUTO"; f.counterAxisSizingMode = "AUTO"; if(p) p.appendChild(f); return f; };
  
  const frame = figma.createFrame();
  frame.name = "${componentName || 'Component'}";
  frame.resize(${width}, ${height});
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
  // Continue building UI...
  
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();

Analyze the image and complete the code. Keep it concise but complete.` }
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: 'API failed', details: errorData });
    }

    const data = await response.json();
    let code = data.content?.[0]?.text || '';

    // Clean up markdown formatting
    code = code.replace(/```javascript\n?/gi, '').replace(/```js\n?/gi, '').replace(/```\n?/g, '').trim();

    // Validate code completeness
    if (!code.includes('figma.currentPage.appendChild') || !code.includes('figma.viewport.scrollAndZoomIntoView')) {
      // Try to fix incomplete code
      if (!code.includes('figma.currentPage.appendChild')) {
        code = code.replace(/\}\)\(\);?\s*$/, `
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();`);
      }
    }

    return res.status(200).json({ success: true, figmaCode: code });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
