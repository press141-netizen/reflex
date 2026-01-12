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
            { type: 'text', text: `You are a UI-to-Figma code converter. Generate precise Figma Plugin API code for this UI (${width}x${height}px).${contextInfo}

## STEP 1: TEXT EXTRACTION (CRITICAL!)
First, carefully read and list ALL visible text in the image:
- Read each word character by character
- Korean text must be copied EXACTLY (한글 정확히 복사)
- Include labels, buttons, tabs, menu items, descriptions
- Do NOT paraphrase or translate - copy verbatim

## STEP 2: LAYOUT ANALYSIS
Identify the structure:
- How many columns? (1열, 2열, etc.)
- What are the rows?
- Spacing between items
- Alignment (left, center, right)

## STEP 3: COMPONENT BREAKDOWN
For this UI, identify:
- Header/Title section
- Tab buttons (if any) - note active/inactive states
- Content area layout (grid, list, etc.)
- List items with bullet points or icons

## CODE TEMPLATE:
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

  // Bullet point helper
  const bullet = (p, text, sz=14, c=rgb(102,102,102)) => {
    const r = row(p, 8);
    txt(r, "▸", sz, c);
    txt(r, text, sz, c);
    return r;
  };

  // Tab button helper
  const tab = (p, text, isActive=false, w=60, h=32) => {
    const f = figma.createFrame();
    f.resize(w, h);
    f.layoutMode = "HORIZONTAL";
    f.primaryAxisAlignItems = "CENTER";
    f.counterAxisAlignItems = "CENTER";
    f.fills = isActive ? [{type:"SOLID",color:hex("#3182F6")}] : [{type:"SOLID",color:hex("#F2F4F6")}];
    f.cornerRadius = 6;
    txt(f, text, 14, isActive ? rgb(255,255,255) : rgb(102,102,102), "Medium");
    p.appendChild(f);
    return f;
  };

  // Main frame
  const main = figma.createFrame();
  main.name = "${componentName || 'Component'}";
  main.resize(${width}, ${height});
  main.layoutMode = "VERTICAL";
  main.primaryAxisSizingMode = "FIXED";
  main.counterAxisSizingMode = "FIXED";
  main.fills = [{type:"SOLID",color:rgb(255,255,255)}];
  main.paddingTop = main.paddingBottom = main.paddingLeft = main.paddingRight = 20;
  main.itemSpacing = 16;

  // === BUILD THE EXACT UI FROM THE IMAGE ===
  // Use the extracted text EXACTLY as shown
  // Match the layout structure precisely
  
  figma.currentPage.appendChild(main);
  figma.viewport.scrollAndZoomIntoView([main]);
})();

## RULES:
1. TEXT MUST BE EXACT - Copy Korean characters precisely: 잔액조회, 거래내역조회, etc.
2. Use the bullet() helper for list items with ▸ markers
3. Use the tab() helper for tab buttons
4. For 2-column layouts: create a row, then add two col() inside
5. Match spacing and alignment from the image
6. NO placeholder text - only use text visible in the image

Generate the complete code now. Remember: EXACT TEXT from the image!` }
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
