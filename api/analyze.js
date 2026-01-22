import { checkRateLimit } from './_utils/rateLimit.js';

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

  // Rate limiting: 5 requests per hour per IP (to prevent AI API abuse)
  const rateLimitResult = checkRateLimit(req, { maxRequests: 5, windowMs: 60 * 60 * 1000 });
  if (rateLimitResult) {
    res.setHeader('Retry-After', rateLimitResult.headers['Retry-After']);
    res.setHeader('X-RateLimit-Limit', rateLimitResult.headers['X-RateLimit-Limit']);
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.headers['X-RateLimit-Remaining']);
    res.setHeader('X-RateLimit-Reset', rateLimitResult.headers['X-RateLimit-Reset']);
    return res.status(429).json(rateLimitResult.body);
  }

  try {
    const { image, componentName, mimeType, imageWidth, imageHeight, context } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    // Validate componentName
    if (componentName && (typeof componentName !== 'string' || componentName.length > 100)) {
      return res.status(400).json({ error: 'Component name must be string, max 100 characters' });
    }

    // Validate dimensions
    if (imageWidth && (typeof imageWidth !== 'number' || imageWidth < 1 || imageWidth > 10000)) {
      return res.status(400).json({ error: 'Image width must be between 1 and 10000' });
    }
    if (imageHeight && (typeof imageHeight !== 'number' || imageHeight < 1 || imageHeight > 10000)) {
      return res.status(400).json({ error: 'Image height must be between 1 and 10000' });
    }

    // Validate mimeType
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    // Validate context
    if (context) {
      if (context.note && (typeof context.note !== 'string' || context.note.length > 1000)) {
        return res.status(400).json({ error: 'Context note too long (max 1000 characters)' });
      }
      if (context.tags && (!Array.isArray(context.tags) || context.tags.length > 20)) {
        return res.status(400).json({ error: 'Too many tags (max 20)' });
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const width = imageWidth || 800;
    const height = imageHeight || 600;
    const mime = mimeType || 'image/png';

    // Sanitize componentName to prevent injection
    const safeName = componentName
      ? componentName.replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 50)
      : 'Component';

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
            { type: 'text', text: `Convert this UI to Figma code. Size: ${width}x${height}px${contextInfo}

## PRIORITY ORDER (MOST IMPORTANT FIRST):
1. LAYOUT STRUCTURE - exact arrangement of elements
2. COLOR VALUES - use eyedropper precision (hex values)
3. SPACING - gaps, padding, margins
4. Text content is NOT important - use placeholder text like "텍스트", "Label", "Title"

## LAYOUT ANALYSIS METHOD:
1. Draw invisible grid lines - identify rows and columns
2. For each section, ask: "Is this HORIZONTAL or VERTICAL arrangement?"
3. Identify nesting: what contains what?
4. Measure approximate pixel gaps between elements

## STRUCTURE RULES:
- If elements are side by side → HORIZONTAL (row)
- If elements are stacked → VERTICAL (col)
- Sidebar + Content = row([sidebar, content])
- Header above Content = col([header, content])
- Cards in a row = row([card1, card2, card3])

## COLOR EXTRACTION:
- Look at ACTUAL colors in the image
- Background colors (light gray, white, etc.)
- Text colors (black, gray, green, red, blue)
- Accent colors (buttons, highlights, badges)
- Extract as close to real hex values as possible

## CODE TEMPLATE:
(async () => {
  await figma.loadFontAsync({family:"Inter",style:"Regular"});
  await figma.loadFontAsync({family:"Inter",style:"Medium"});
  await figma.loadFontAsync({family:"Inter",style:"Bold"});

  const rgb = (r,g,b) => ({r:r/255,g:g/255,b:b/255});
  const hex = (h) => {const v=h.replace('#','');return rgb(parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16));};
  
  const txt = (p,s,sz,c,st="Regular") => {
    const t=figma.createText();
    t.fontName={family:"Inter",style:st};
    t.characters=String(s);
    t.fontSize=sz;
    t.fills=[{type:"SOLID",color:c}];
    p.appendChild(t);
    return t;
  };
  
  const rect = (p,w,h,c,r=0) => {
    const b=figma.createRectangle();
    b.resize(w,h);
    b.fills=[{type:"SOLID",color:c}];
    if(r)b.cornerRadius=r;
    p.appendChild(b);
    return b;
  };
  
  const frame = (p, dir, gap=0) => {
    const f = figma.createFrame();
    f.layoutMode = dir;
    f.itemSpacing = gap;
    f.primaryAxisSizingMode = "AUTO";
    f.counterAxisSizingMode = "AUTO";
    f.fills = [];
    if(p) p.appendChild(f);
    return f;
  };
  
  const row = (p, gap=0) => frame(p, "HORIZONTAL", gap);
  const col = (p, gap=0) => frame(p, "VERTICAL", gap);
  
  const card = (p, w, h, bgColor, radius=8, padX=16, padY=16, gap=12) => {
    const f = figma.createFrame();
    f.layoutMode = "VERTICAL";
    f.itemSpacing = gap;
    f.paddingLeft = f.paddingRight = padX;
    f.paddingTop = f.paddingBottom = padY;
    f.primaryAxisSizingMode = "FIXED";
    f.counterAxisSizingMode = "FIXED";
    f.resize(w, h);
    f.fills = [{type:"SOLID",color:bgColor}];
    f.cornerRadius = radius;
    if(p) p.appendChild(f);
    return f;
  };

  // Main
  const main = figma.createFrame();
  main.name = "${safeName}";
  main.layoutMode = "VERTICAL";
  main.primaryAxisSizingMode = "AUTO";
  main.counterAxisSizingMode = "AUTO";
  main.fills = [{type:"SOLID",color:hex("#FFFFFF")}];
  main.paddingTop = main.paddingBottom = main.paddingLeft = main.paddingRight = 20;
  main.itemSpacing = 16;

  // === ANALYZE THE IMAGE AND BUILD MATCHING STRUCTURE ===
  // Focus on: exact layout hierarchy, real colors from image
  // Text can be placeholder: "텍스트", "Label", etc.
  
  figma.currentPage.appendChild(main);
  figma.viewport.scrollAndZoomIntoView([main]);
})();

OUTPUT: Only JavaScript code. Match the EXACT visual layout structure and colors from the image.` }
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
    
    // Remove text before (async
    const asyncIndex = code.indexOf('(async');
    if (asyncIndex > 0) {
      code = code.substring(asyncIndex);
    }
    
    // Remove text after })();
    const endIndex = code.lastIndexOf('})();');
    if (endIndex !== -1) {
      code = code.substring(0, endIndex + 5);
    }
    
    // Fix invalid Figma API values
    code = code.replace(/primaryAxisSizingMode\s*=\s*["'](FILL_CONTAINER|FILL|HUG)["']/gi, 'primaryAxisSizingMode = "AUTO"');
    code = code.replace(/counterAxisSizingMode\s*=\s*["'](FILL_CONTAINER|FILL|HUG)["']/gi, 'counterAxisSizingMode = "AUTO"');
    code = code.replace(/layoutAlign\s*=\s*["']FILL["']/gi, 'layoutAlign = "STRETCH"');
    
    // Ensure completion
    if (!code.includes('figma.currentPage.appendChild')) {
      code += '\n  figma.currentPage.appendChild(main);\n  figma.viewport.scrollAndZoomIntoView([main]);\n})();';
    }

    return res.status(200).json({ success: true, figmaCode: code });

  } catch (error) {
    console.error('Analyze API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
