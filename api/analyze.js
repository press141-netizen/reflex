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

    let contextInfo = '';
    if (context) {
      const parts = [];
      if (context.note) parts.push(`Note: "${context.note}"`);
      if (context.tags?.length) parts.push(`Tags: ${context.tags.join(', ')}`);
      if (parts.length) contextInfo = `\n${parts.join(' | ')}`;
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
            { type: 'text', text: `Convert this UI screenshot to Figma Plugin API code.
Image size: ${width}x${height}px${contextInfo}

CRITICAL RULES:
1. ALWAYS use Auto Layout (layoutMode) - NEVER use absolute positioning
2. Every container must have layoutMode = "HORIZONTAL" or "VERTICAL"
3. Use itemSpacing for gaps between children
4. Use padding for internal spacing
5. Match the exact layout structure from the image

AUTO LAYOUT PROPERTIES:
- layoutMode: "HORIZONTAL" or "VERTICAL"
- itemSpacing: gap between children (8, 12, 16, 20, 24, 32)
- paddingTop, paddingBottom, paddingLeft, paddingRight
- primaryAxisAlignItems: "MIN", "CENTER", "MAX", "SPACE_BETWEEN"
- counterAxisAlignItems: "MIN", "CENTER", "MAX"
- primaryAxisSizingMode: "AUTO" or "FIXED"
- counterAxisSizingMode: "AUTO" or "FIXED"

LAYOUT PATTERNS:
- Navbar: HORIZONTAL + primaryAxisAlignItems="SPACE_BETWEEN"
- Card: VERTICAL + padding + cornerRadius
- List: VERTICAL + itemSpacing
- Row of items: HORIZONTAL + itemSpacing
- Centered content: primaryAxisAlignItems="CENTER" + counterAxisAlignItems="CENTER"

RETURN ONLY CODE - Start with (async and end with })();

(async () => {
  await figma.loadFontAsync({family:"Inter",style:"Regular"});
  await figma.loadFontAsync({family:"Inter",style:"Medium"});
  await figma.loadFontAsync({family:"Inter",style:"Bold"});

  const rgb = (r,g,b) => ({r:r/255,g:g/255,b:b/255});
  
  // Text helper
  const txt = (p,s,sz,c,st="Regular") => {
    const t=figma.createText();
    t.fontName={family:"Inter",style:st};
    t.characters=String(s);
    t.fontSize=sz;
    t.fills=[{type:"SOLID",color:c}];
    p.appendChild(t);
    return t;
  };
  
  // Auto Layout Frame helper
  const autoFrame = (p, dir, gap=0, padX=0, padY=0) => {
    const f = figma.createFrame();
    f.layoutMode = dir; // "HORIZONTAL" or "VERTICAL"
    f.itemSpacing = gap;
    f.paddingLeft = f.paddingRight = padX;
    f.paddingTop = f.paddingBottom = padY;
    f.primaryAxisSizingMode = "AUTO";
    f.counterAxisSizingMode = "AUTO";
    f.fills = [];
    if(p) p.appendChild(f);
    return f;
  };
  
  // Horizontal Auto Layout
  const row = (p, gap=0, padX=0, padY=0) => autoFrame(p, "HORIZONTAL", gap, padX, padY);
  
  // Vertical Auto Layout  
  const col = (p, gap=0, padX=0, padY=0) => autoFrame(p, "VERTICAL", gap, padX, padY);
  
  // Icon placeholder
  const icon = (p,w,h,c,r=4) => {
    const b=figma.createRectangle();
    b.resize(w,h);
    b.fills=[{type:"SOLID",color:c}];
    b.cornerRadius=r;
    p.appendChild(b);
    return b;
  };

  // Main container - Auto Layout
  const main = figma.createFrame();
  main.name = "${componentName || 'Component'}";
  main.layoutMode = "VERTICAL";
  main.primaryAxisSizingMode = "AUTO";
  main.counterAxisSizingMode = "AUTO";
  main.fills = [{type:"SOLID",color:rgb(255,255,255)}];
  main.paddingTop = main.paddingBottom = main.paddingLeft = main.paddingRight = 20;
  main.itemSpacing = 16;

  // BUILD UI HERE using row(), col(), txt(), icon()
  // All containers must use Auto Layout!
  
  figma.currentPage.appendChild(main);
  figma.viewport.scrollAndZoomIntoView([main]);
})();

Generate code that uses ONLY Auto Layout. No absolute positioning. No manual x/y coordinates.` }
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
    
    // Remove any text before (async
    const asyncIndex = code.indexOf('(async');
    if (asyncIndex > 0) {
      code = code.substring(asyncIndex);
    }
    
    // Remove any text after the closing })();
    const endIndex = code.lastIndexOf('})();');
    if (endIndex !== -1) {
      code = code.substring(0, endIndex + 5);
    }
    
    // Fix invalid Figma API values
    code = code.replace(/primaryAxisSizingMode\s*=\s*["'](FILL_CONTAINER|FILL|HUG)["']/gi, 'primaryAxisSizingMode = "AUTO"');
    code = code.replace(/counterAxisSizingMode\s*=\s*["'](FILL_CONTAINER|FILL|HUG)["']/gi, 'counterAxisSizingMode = "AUTO"');
    code = code.replace(/layoutAlign\s*=\s*["']FILL["']/gi, 'layoutAlign = "STRETCH"');
    code = code.replace(/justifyContent/gi, 'primaryAxisAlignItems');
    
    // Ensure code completion
    if (!code.includes('figma.currentPage.appendChild')) {
      code += '\n  figma.currentPage.appendChild(main);\n  figma.viewport.scrollAndZoomIntoView([main]);\n})();';
    }

    return res.status(200).json({ success: true, figmaCode: code });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
