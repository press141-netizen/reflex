export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // CORS 설정 (보안을 위해 프로덕션에서는 특정 도메인만 허용하는 것이 좋습니다)
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
    // context(노트), tags 추가 수신
    const { image, componentName, mimeType, imageWidth, imageHeight, context, tags } = req.body;

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

    // AI에게 줄 추가 정보 구성
    const designContext = context ? `Design Context/Description: ${context}` : '';
    const designTags = tags && tags.length > 0 ? `Tags/Style: ${tags.join(', ')}` : '';

    const systemPrompt = `
Generate Figma Plugin API code for this UI component (${width}x${height}px).
${designContext}
${designTags}

RULES:
1. Return ONLY valid JavaScript code. NO markdown, NO explanations.
2. Use the provided helpers: txt(), box(), row(), col().
3. Structure:
   - Use figma.createFrame() with layoutMode "HORIZONTAL" (row) or "VERTICAL" (col) for Auto Layout.
   - Accurately estimate padding, itemSpacing (gap), and cornerRadius from the image.
   - Detect text hierarchy (headings vs body) and use "Semi Bold" or "Regular" accordingly.
4. Colors: Use hex codes converted to {r, g, b} (helper handles this, just pass hex string if creating helper, or simple logic). 
   *Wait, the provided helpers take simpler inputs. Follow the START CODE helpers exactly.*
5. FINAL OUPUT must end with appending to currentPage and scrolling into view.

START CODE TEMPLATE:
(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  
  // Helpers
  const hex = (c) => { 
    // Simple hex to RGB helper if needed, or assume helpers take standard Figma color objects
    // For this prompt, let's assume standard RGB generation in the main logic or simple colors.
    // Actually, let's use the provided simple helpers in the user prompt.
  };
  
  const txt = (p, s, sz, c, st = "Regular") => { const t = figma.createText(); t.fontName = { family: "Inter", style: st }; t.characters = s; t.fontSize = sz; t.fills = [{ type: 'SOLID', color: c }]; p.appendChild(t); return t; };
  const box = (p, w, h, c, r = 0) => { const b = figma.createRectangle(); b.resize(w, h); b.fills = [{ type: 'SOLID', color: c }]; b.cornerRadius = r; p.appendChild(b); return b; };
  // ... (Include other helpers provided in user prompt) ...
  
  const frame = figma.createFrame();
  frame.name = "${componentName || 'Component'}";
  frame.resize(${width}, ${height});
  // ...
  
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();
`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620', // 최신 안정 모델 권장 (Sonnet 3.5)
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
            { type: 'text', text: systemPrompt }
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Anthropic API Error:', errorData);
      return res.status(response.status).json({ error: 'AI processing failed', details: errorData });
    }

    const data = await response.json();
    let code = data.content?.[0]?.text || '';
    
    // Markdown 제거
    code = code.replace(/```javascript\n?/gi, '').replace(/```js\n?/gi, '').replace(/```\n?/g, '').trim();
    
    // 코드 완성도 검사 및 보정
    if (!code.includes('figma.currentPage.appendChild')) {
      // 닫는 괄호들이 있다면 제거하고 마지막에 append 코드 추가
      code = code.replace(/\}\)\(\);?\s*$/, '') + `
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();`;
    }

    return res.status(200).json({ success: true, figmaCode: code });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
