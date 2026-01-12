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

PRIORITY: LAYOUT ACCURACY IS MOST IMPORTANT!

LAYOUT ANALYSIS STEPS:
1. Measure the EXACT position of each element (x, y coordinates)
2. Measure the EXACT size of each element (width, height)
3. Identify spacing between elements (gaps, padding, margins)
4. Identify alignment (left, center, right, space-between)
5. Identify the hierarchy (what contains what)

LAYOUT PATTERNS TO DETECT:
- Navbar: horizontal layout with logo on left, menu items on right (use justifyContent space-between)
- Cards: container with padding, border-radius, possibly shadow
- Lists: vertical stack with consistent spacing
- Grid: rows containing multiple columns
- Forms: labels above inputs, consistent spacing

FOR HORIZONTAL LAYOUTS (like navbars):
- Use layoutMode = "HORIZONTAL"
- Use primaryAxisAlignItems = "SPACE_BETWEEN" for left/right separation
- Use counterAxisAlignItems = "CENTER" for vertical centering

FOR ICON + TEXT PAIRS:
- Create a horizontal frame
- Add a small rectangle (icon placeholder) + text
- Gap between icon and text

IMPORTANT MEASUREMENTS:
- Estimate pixel positions from the image
- Match padding values (8, 12, 16, 20, 24, 32 are common)
- Match gap values between elements
- Match border-radius (4, 8, 12, 16 are common)

RETURN ONLY CODE - Start with (async and end with })();

(async () => {
  await figma.loadFontAsync({family:"Inter",style:"Regular"});
  await figma.loadFontAsync({family:"Inter",style:"Medium"});
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
  
  const icon = (p,w,h,c,r=4) => {
    const b=figma.createRectangle();
    b.resize(w,h);
    b.fills=[{type:"SOLID",color:c}];
    b.cornerRadius=r;
    p.appendChild(b);
    return b;
  };

  const main = figma.createFrame();
  main.name = "${componentName || 'Component'}";
  main.resize(${width}, ${height});
  main.layoutMode = "HORIZONTAL";
  main.primaryAxisSizingMode = "FIXED";
  main.counterAxisSizingMode = "FIXED";
  main.counterAxisAlignItems = "CENTER";
  main.primaryAxisAlignItems = "SPACE_BETWEEN";
  main.fills = [{type:"SOLID",color:rgb(255,255,255)}];
  main.paddingLeft = main.paddingRight = 24;
  main.paddingTop = main.paddingBottom = 16;

  // LEFT SECTION
  const leftSection = figma.createFrame();
  leftSection.layoutMode = "HORIZONTAL";
  leftSection.itemSpacing = 12;
  leftSection.counterAxisAlignItems = "CENTER";
  leftSection.primaryAxisSizingMode = "AUTO";
  leftSection.counterAxisSizingMode = "AUTO";
  leftSection.fills = [];
  main.appendChild(leftSection);

  // RIGHT SECTION  
  const rightSection = figma.createFrame();
  rightSection.layoutMode = "HORIZONTAL";
  rightSection.itemSpacing = 24;
  rightSection.counterAxisAlignItems = "CENTER";
  rightSection.primaryAxisSizingMode = "AUTO";
  rightSection.counterAxisSizingMode = "AUTO";
  rightSection.fills = [];
  main.appendChild(rightSection);

  // BUILD ELEMENTS HERE based on the image layout
  
  figma.currentPage.appendChild(main);
  figma.viewport.scrollAndZoomIntoView([main]);
})();

Generate code that matches the EXACT LAYOUT and POSITIONS from the image.` }
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
