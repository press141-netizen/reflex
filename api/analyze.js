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
    const { image, componentName, mimeType, imageWidth, imageHeight, context } = req.body;

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

    // 컨텍스트 정보 구성
    let contextInfo = '';
    if (context) {
      const parts = [];
      if (context.note) parts.push(`Description: "${context.note}"`);
      if (context.tags?.length) parts.push(`Tags: ${context.tags.join(', ')}`);
      if (context.type) parts.push(`Type: ${context.type}`);
      if (context.category) parts.push(`Category: ${context.category}`);
      if (parts.length) {
        contextInfo = `\n\nCONTEXT INFORMATION (use this to understand the UI better):\n${parts.join('\n')}`;
      }
    }

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
            { type: 'text', text: `Generate Figma Plugin API code for this UI (${width}x${height}px).${contextInfo}

RULES:
- Return ONLY JavaScript code, no markdown
- Use helpers: txt(), box(), row(), col() as shown below
- Charts/graphs = single placeholder rectangle with appropriate color
- Icons = small colored rectangles (16-24px)
- MUST end with figma.currentPage.appendChild() and figma.viewport.scrollAndZoomIntoView()
- All fixed-size frames need: primaryAxisSizingMode = "FIXED"; counterAxisSizingMode = "FIXED";
- Match the colors and layout from the image accurately

CODE TEMPLATE:
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
  // Build the UI structure here...
  
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();

Analyze the image carefully and generate complete, working code.` }
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
