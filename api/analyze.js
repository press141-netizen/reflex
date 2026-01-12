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
            { type: 'text', text: `Convert this UI to Figma Plugin API code (${width}x${height}px).${contextInfo}

CRITICAL RULES:
1. Return ONLY executable JavaScript code - no explanations, no markdown, no comments about steps
2. Copy ALL visible text EXACTLY as shown (Korean text 한글 정확히)
3. Match the layout structure precisely

CODE TEMPLATE (start your response with this exact code):
(async () => {
  await figma.loadFontAsync({family:"Inter",style:"Regular"});
  await figma.loadFontAsync({family:"Inter",style:"Medium"});
  await figma.loadFontAsync({family:"Inter",style:"Semi Bold"});
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
  
  const box = (p,w,h,c,r=0) => {
    const b=figma.createRectangle();
    b.resize(w,h);
    b.fills=[{type:"SOLID",color:c}];
    if(r)b.cornerRadius=r;
    p.appendChild(b);
    return b;
  };
  
  const frame = (p,dir,gap=0,px=0,py=0) => {
    const f=figma.createFrame();
    f.layoutMode=dir;
    f.itemSpacing=gap;
    f.paddingLeft=f.paddingRight=px;
    f.paddingTop=f.paddingBottom=py;
    f.primaryAxisSizingMode="AUTO";
    f.counterAxisSizingMode="AUTO";
    f.fills=[];
    if(p)p.appendChild(f);
    return f;
  };
  
  const row = (p,gap=0) => frame(p,"HORIZONTAL",gap);
  const col = (p,gap=0) => frame(p,"VERTICAL",gap);

  const main = figma.createFrame();
  main.name = "${componentName || 'Component'}";
  main.resize(${width}, ${height});
  main.layoutMode = "VERTICAL";
  main.primaryAxisSizingMode = "FIXED";
  main.counterAxisSizingMode = "FIXED";
  main.fills = [{type:"SOLID",color:rgb(255,255,255)}];
  main.paddingTop = main.paddingBottom = main.paddingLeft = main.paddingRight = 20;
  main.itemSpacing = 16;

  // BUILD UI HERE - use exact text from image
  
  figma.currentPage.appendChild(main);
  figma.viewport.scrollAndZoomIntoView([main]);
})();

OUTPUT: Return ONLY the complete JavaScript code. No explanations. No step descriptions. Just code.` }
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
    const endMatch = code.match(/\}\)\(\);?\s*$/);
    if (endMatch) {
      const endIndex = code.lastIndexOf('})();');
      if (endIndex !== -1) {
        code = code.substring(0, endIndex + 5);
      }
    }
    
    // Fix invalid Figma API values
    code = code.replace(/primaryAxisSizingMode\s*=\s*["'](FILL_CONTAINER|FILL|HUG)["']/gi, 'primaryAxisSizingMode = "AUTO"');
    code = code.replace(/counterAxisSizingMode\s*=\s*["'](FILL_CONTAINER|FILL|HUG)["']/gi, 'counterAxisSizingMode = "AUTO"');
    code = code.replace(/layoutAlign\s*=\s*["']FILL["']/gi, 'layoutAlign = "STRETCH"');
    
    // Ensure code completion
    if (!code.includes('figma.currentPage.appendChild')) {
      code += '\n  figma.currentPage.appendChild(main);\n  figma.viewport.scrollAndZoomIntoView([main]);\n})();';
    }

    return res.status(200).json({ success: true, figmaCode: code });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
