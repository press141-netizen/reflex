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

    // 컨텍스트 정보
    let contextInfo = '';
    if (context) {
      const parts = [];
      if (context.note) parts.push(`Description: "${context.note}"`);
      if (context.tags?.length) parts.push(`Tags: ${context.tags.join(', ')}`);
      if (context.type) parts.push(`Type: ${context.type}`);
      if (context.category) parts.push(`Category: ${context.category}`);
      if (parts.length) contextInfo = `\nCONTEXT: ${parts.join(' | ')}`;
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
            { type: 'text', text: `Analyze this UI screenshot and generate Figma Plugin API code (${width}x${height}px).${contextInfo}

CRITICAL REQUIREMENTS:
1. **INCLUDE ALL VISIBLE TEXT** - Every text you see MUST be included using txt() function
2. **READ ALL TEXT CAREFULLY** - Copy the exact text content from the image
3. Use proper layout structure with row() and col() helpers
4. Match colors as closely as possible

ELEMENT HANDLING:
- Text: ALWAYS include using txt(parent, "exact text here", fontSize, color, style)
- Input fields: Rectangle with border + placeholder text inside
- Buttons: Rectangle with text inside
- Cards: Rectangle container with content inside  
- Charts/Graphs: Single gray rectangle placeholder (do NOT try to recreate data)
- Icons: Small colored rectangle (16-24px)

VALID FIGMA API VALUES:
- primaryAxisSizingMode: "FIXED" or "AUTO" only
- counterAxisSizingMode: "FIXED" or "AUTO" only
- Use layoutGrow = 1 for flexible elements

CODE STRUCTURE:
(async () => {
  await figma.loadFontAsync({family:"Inter",style:"Regular"});
  await figma.loadFontAsync({family:"Inter",style:"Medium"});
  await figma.loadFontAsync({family:"Inter",style:"Semi Bold"});
  await figma.loadFontAsync({family:"Inter",style:"Bold"});

  const rgb = (r,g,b) => ({r:r/255,g:g/255,b:b/255});
  
  const txt = (p,s,sz,c,st="Regular") => {
    const t=figma.createText();
    t.fontName={family:"Inter",style:st};
    t.characters=String(s);
    t.fontSize=sz;
    t.fills=[{type:"SOLID",color:c}];
    p.appendChild(t);
    return t;
  };
  
  const box = (p,w,h,c,r=0) => {
    const b=figma.createRectangle();
    b.resize(w,h);
    b.fills=[{type:"SOLID",color:c}];
    if(r)b.cornerRadius=r;
    p.appendChild(b);
    return b;
  };
  
  const row = (p,gap=0,pad=0) => {
    const f=figma.createFrame();
    f.layoutMode="HORIZONTAL";
    f.itemSpacing=gap;
    f.paddingTop=f.paddingBottom=f.paddingLeft=f.paddingRight=pad;
    f.primaryAxisSizingMode="AUTO";
    f.counterAxisSizingMode="AUTO";
    f.fills=[];
    f.counterAxisAlignItems="CENTER";
    if(p)p.appendChild(f);
    return f;
  };
  
  const col = (p,gap=0,pad=0) => {
    const f=figma.createFrame();
    f.layoutMode="VERTICAL";
    f.itemSpacing=gap;
    f.paddingTop=f.paddingBottom=f.paddingLeft=f.paddingRight=pad;
    f.primaryAxisSizingMode="AUTO";
    f.counterAxisSizingMode="AUTO";
    f.fills=[];
    if(p)p.appendChild(f);
    return f;
  };

  // Main frame
  const main = figma.createFrame();
  main.name = "${componentName || 'Component'}";
  main.resize(${width}, ${height});
  main.layoutMode = "VERTICAL";
  main.primaryAxisSizingMode = "FIXED";
  main.counterAxisSizingMode = "FIXED";
  main.fills = [{type:"SOLID",color:rgb(250,250,250)}]; // Adjust to match
  main.paddingTop = main.paddingBottom = main.paddingLeft = main.paddingRight = 24;
  main.itemSpacing = 16;

  // === BUILD UI HERE ===
  // Remember: INCLUDE ALL TEXT using txt() function!
  // Example: txt(main, "Hello World", 24, rgb(0,0,0), "Bold");
  
  figma.currentPage.appendChild(main);
  figma.viewport.scrollAndZoomIntoView([main]);
})();

Now generate the code. IMPORTANT: Include EVERY piece of text visible in the image!` }
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
    
    // Clean markdown
    code = code.replace(/```javascript\n?/gi, '').replace(/```js\n?/gi, '').replace(/```\n?/g, '').trim();
    
    // Fix invalid values
    code = code.replace(/primaryAxisSizingMode\s*=\s*["'](FILL_CONTAINER|FILL|HUG)["']/gi, 'primaryAxisSizingMode = "AUTO"');
    code = code.replace(/counterAxisSizingMode\s*=\s*["'](FILL_CONTAINER|FILL|HUG)["']/gi, 'counterAxisSizingMode = "AUTO"');
    code = code.replace(/layoutAlign\s*=\s*["']FILL["']/gi, 'layoutAlign = "STRETCH"');
    
    // Ensure completion
    if (!code.includes('figma.currentPage.appendChild')) {
      code += '\n  figma.currentPage.appendChild(main);\n  figma.viewport.scrollAndZoomIntoView([main]);\n})();';
    }

    return res.status(200).json({ success: true, figmaCode: code });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
