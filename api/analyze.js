// 파일 경로: api/analyze.js

export const config = {
  maxDuration: 60, // AI 분석 시간 확보 (60초)
};

export default async function handler(req, res) {
  // CORS 설정 (모든 도메인 허용)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, componentName, mimeType, imageWidth, imageHeight, context, tags } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('API Key Missing');
      return res.status(500).json({ error: 'Server API key not configured' });
    }

    const width = imageWidth || 400;
    const height = imageHeight || 300;
    const mime = mimeType || 'image/png';

    // AI에게 전달할 추가 정보
    const designContext = context ? `Design Context: ${context}` : '';
    const designTags = tags && tags.length > 0 ? `Style Tags: ${tags.join(', ')}` : '';

    const systemPrompt = `
Generate Figma Plugin API code for this UI component (${width}x${height}px).
${designContext}
${designTags}

RULES:
1. Return ONLY valid JavaScript code. NO markdown formatting.
2. Use standard Figma API: figma.createFrame(), figma.createText(), figma.createRectangle().
3. Helper functions provided in START CODE: txt(), box(), row(), col(). Use them.
4. Auto Layout: Use layoutMode "HORIZONTAL" or "VERTICAL".
5. Fonts: Use "Inter".
6. END with: appending to figma.currentPage and scrolling into view.

START CODE TEMPLATE:
(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  
  const txt = (p,s,sz,c,st="Regular")=>{const t=figma.createText();t.fontName={family:"Inter",style:st};t.characters=s;t.fontSize=sz;t.fills=[{type:'SOLID',color:c}];p.appendChild(t);return t;};
  const box = (p,w,h,c,r=0)=>{const b=figma.createRectangle();b.resize(w,h);b.fills=[{type:'SOLID',color:c}];b.cornerRadius=r;p.appendChild(b);return b;};
  
  const frame = figma.createFrame();
  frame.name = "${componentName || 'Component'}";
  frame.resize(${width}, ${height});
  
  // ... (Your Generated Code) ...
  
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();
`;

    // 유효한 최신 모델(Claude 3.5 Sonnet) 사용
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620', 
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
    
    // 마크다운 제거
    code = code.replace(/```javascript\n?/gi, '').replace(/```js\n?/gi, '').replace(/```\n?/g, '').trim();
    
    // 코드 안전장치 (실행 구문 누락 방지)
    if (!code.includes('figma.currentPage.appendChild')) {
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
