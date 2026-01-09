export const config = {
  maxDuration: 60, // AI 분석이 길어질 수 있으므로 타임아웃 60초 설정
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 클라이언트에서 보낸 데이터 수신 (context, tags 추가됨)
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

    // AI에게 전달할 추가 디자인 맥락 구성
    const designContext = context ? `Design Context/Description: ${context}` : '';
    const designTags = tags && tags.length > 0 ? `Tags/Style: ${tags.join(', ')}` : '';

    // 프롬프트 엔지니어링: Auto Layout과 계층 구조를 명확히 지시
    const systemPrompt = `
Generate Figma Plugin API code for this UI component (${width}x${height}px).
${designContext}
${designTags}

RULES:
1. Return ONLY valid JavaScript code. NO markdown formatting, NO explanations.
2. Structure:
   - Use figma.createFrame() with layoutMode "HORIZONTAL" (row) or "VERTICAL" (col) for Auto Layout where appropriate.
   - Accurately estimate padding, itemSpacing (gap), and cornerRadius.
   - Use "Inter" font. Detect text hierarchy (Bold for headings, Regular for body).
3. Colors: Use simple hex codes (e.g., "#FFFFFF").
4. Helpers provided: txt(), box(), row(), col(). Use them to keep code concise.
5. FINAL OUPUT must end with appending to figma.currentPage and scrolling into view.

START CODE TEMPLATE:
(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  
  const frame = figma.createFrame();
  frame.name = "${componentName || 'Component'}";
  frame.resize(${width}, ${height});
  frame.layoutMode = "VERTICAL";
  
  // ... (Your generated code here) ...
  
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();
`;

    // Anthropic (Claude) API 호출
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620', // 최신 모델 사용 (속도/성능 균형)
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
    
    // Markdown 코드 블록 제거 (```javascript ... ```)
    code = code.replace(/```javascript\n?/gi, '').replace(/```js\n?/gi, '').replace(/```\n?/g, '').trim();
    
    // 코드 안전장치: 마지막 실행 구문이 없으면 추가
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
