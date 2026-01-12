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

    const width = imageWidth || 800;
    const height = imageHeight || 600;
    const mime = mimeType || 'image/png';

    // 컨텍스트 정보 구성
    let contextInfo = '';
    if (context) {
      const parts = [];
      if (context.note) parts.push(`User Description: "${context.note}"`);
      if (context.tags?.length) parts.push(`Tags: ${context.tags.join(', ')}`);
      if (context.type) parts.push(`UI Type: ${context.type}`);
      if (context.category) parts.push(`Category: ${context.category}`);
      if (parts.length) {
        contextInfo = `\n\nCONTEXT (use this to better understand the UI):\n${parts.join('\n')}`;
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
            { type: 'text', text: `Analyze this UI screenshot and generate Figma Plugin API JavaScript code to recreate it accurately.

TARGET SIZE: ${width}x${height}px${contextInfo}

STRICT RULES:
1. Return ONLY executable JavaScript - NO markdown backticks, NO explanations
2. CAREFULLY analyze: colors, layout, typography, spacing, all visible elements
3. VALID Figma API values ONLY:
   - primaryAxisSizingMode: "FIXED" or "AUTO" only
   - counterAxisSizingMode: "FIXED" or "AUTO" only  
   - layoutAlign: "STRETCH", "CENTER", "MIN", "MAX", "INHERIT"
   - Use layoutGrow = 1 for elements that should fill space
4. For dark UI: extract actual dark gray colors (not pure black)
5. Charts/graphs: colored rectangle placeholders matching visible colors
6. Icons: small colored rectangles (16-24px)

ANALYZE THE IMAGE FOR:
- Background colors (main, sidebar, cards)
- Text colors and sizes
- Layout structure (sidebar width, header height, grid)
- All visible text content
- Button styles, card styles
- Spacing between elements

COMPLETE CODE TEMPLATE:
(async () => {
  await figma.loadFontAsync({family:"Inter", style:"Regular"});
  await figma.loadFontAsync({family:"Inter", style:"Medium"});
  await figma.loadFontAsync({family:"Inter", style:"Semi Bold"});
  await figma.loadFontAsync({family:"Inter", style:"Bold"});

  const rgb = (r,g,b) => ({r:r/255, g:g/255, b:b/255});
  
  const addText = (parent, str, size, color, style="Regular") => {
    const t = figma.createText();
    t.fontName = {family:"Inter", style};
    t.characters = String(str);
    t.fontSize = size;
    t.fills = [{type:"SOLID", color}];
    parent.appendChild(t);
    return t;
  };
  
  const addRect = (parent, w, h, color, radius=0) => {
    const r = figma.createRectangle();
    r.resize(w, h);
    r.fills = [{type:"SOLID", color}];
    if(radius > 0) r.cornerRadius = radius;
    parent.appendChild(r);
    return r;
  };
  
  const addFrame = (parent, direction, gap, bgColor=null, padding=0) => {
    const f = figma.createFrame();
    f.layoutMode = direction;
    f.itemSpacing = gap;
    f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = padding;
    f.fills = bgColor ? [{type:"SOLID", color:bgColor}] : [];
    f.primaryAxisSizingMode = "AUTO";
    f.counterAxisSizingMode = "AUTO";
    if(parent) parent.appendChild(f);
    return f;
  };

  // Main container
  const main = figma.createFrame();
  main.name = "${componentName || 'Dashboard'}";
  main.resize(${width}, ${height});
  main.layoutMode = "HORIZONTAL";
  main.primaryAxisSizingMode = "FIXED";
  main.counterAxisSizingMode = "FIXED";
  main.clipsContent = true;
  
  // TODO: Analyze the image and build the exact UI structure
  // Set main.fills to the actual background color from the image
  // Create sidebar, header, content sections as seen in the image
  // Match all colors, text, and spacing

  figma.currentPage.appendChild(main);
  figma.viewport.scrollAndZoomIntoView([main]);
})();

Generate complete working code that recreates the UI in the image as accurately as possible. Include ALL visible elements, text, and match the exact colors.` }
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
    
    // Fix common Figma API errors
    code = code.replace(/primaryAxisSizingMode\s*=\s*["']FILL_CONTAINER["']/g, 'primaryAxisSizingMode = "AUTO"');
    code = code.replace(/counterAxisSizingMode\s*=\s*["']FILL_CONTAINER["']/g, 'counterAxisSizingMode = "AUTO"');
    code = code.replace(/primaryAxisSizingMode\s*=\s*["']FILL["']/g, 'primaryAxisSizingMode = "AUTO"');
    code = code.replace(/counterAxisSizingMode\s*=\s*["']FILL["']/g, 'counterAxisSizingMode = "AUTO"');
    code = code.replace(/layoutAlign\s*=\s*["']FILL["']/g, 'layoutAlign = "STRETCH"');
    
    // Ensure code completion
    if (!code.includes('figma.currentPage.appendChild')) {
      code += `\n  figma.currentPage.appendChild(main);\n  figma.viewport.scrollAndZoomIntoView([main]);\n})();`;
    }

    return res.status(200).json({ success: true, figmaCode: code });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
