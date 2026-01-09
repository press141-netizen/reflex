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
    const { image, componentName, mimeType, imageWidth, imageHeight } = req.body;

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
            { type: 'text', text: `Analyze this UI and generate COMPACT Figma Plugin code. Target size: ${width}x${height}px.

CRITICAL RULES:
1. FOCUS ON LAYOUT STRUCTURE, not pixel-perfect details
2. Keep code SHORT - use helper functions for repeated elements
3. For charts/graphs: create simple PLACEHOLDER rectangles, NOT actual data points
4. For icons: use small colored rectangles (16-24px)
5. Group similar items in loops when possible
6. ALWAYS complete the code - never leave it unfinished

OUTPUT FORMAT - Return ONLY this JavaScript (no markdown):

(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  
  // Helper: create text
  const txt = (parent, str, size, color, style = "Regular") => {
    const t = figma.createText();
    t.fontName = { family: "Inter", style };
    t.characters = str;
    t.fontSize = size;
    t.fills = [{ type: 'SOLID', color }];
    parent.appendChild(t);
    return t;
  };
  
  // Helper: create box
  const box = (parent, w, h, color, radius = 0) => {
    const r = figma.createRectangle();
    r.resize(w, h);
    r.fills = [{ type: 'SOLID', color }];
    r.cornerRadius = radius;
    parent.appendChild(r);
    return r;
  };
  
  // Helper: create row/column frame
  const container = (parent, mode, spacing, padding = 0) => {
    const f = figma.createFrame();
    f.layoutMode = mode;
    f.itemSpacing = spacing;
    f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = padding;
    f.fills = [];
    f.primaryAxisSizingMode = "AUTO";
    f.counterAxisSizingMode = "AUTO";
    if (parent) parent.appendChild(f);
    return f;
  };
  
  const frame = figma.createFrame();
  frame.name = "${componentName || 'Component'}";
  frame.resize(${width}, ${height});
  frame.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.12 } }]; // Detect actual bg color
  frame.cornerRadius = 16;
  frame.layoutMode = "VERTICAL";
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 24;
  frame.itemSpacing = 24;
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
  
  // BUILD STRUCTURE HERE - Focus on main sections:
  // 1. Header/Title
  // 2. Main content area (chart = simple placeholder rectangle)
  // 3. Labels/Legend
  // 4. Stats/Metrics
  
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();

CHART/GRAPH HANDLING:
- Do NOT draw individual data points or lines
- Create ONE rectangle as chart placeholder:
  const chartPlaceholder = box(chartArea, 600, 200, { r: 0.15, g: 0.15, b: 0.18 }, 8);
- Add axis labels below/beside as text

EXAMPLE FOR STATS ROW:
const statsRow = container(frame, "HORIZONTAL", 40);
["16k", "256", "80"].forEach((val, i) => {
  const stat = container(statsRow, "VERTICAL", 8);
  const colors = [{r:0.3,g:0.5,b:1}, {r:0.2,g:0.8,b:0.8}, {r:1,g:0.4,b:0.4}];
  box(stat, 8, 8, colors[i], 4);
  txt(stat, val, 48, {r:1,g:1,b:1}, "Semi Bold");
});

KEEP IT SIMPLE. COMPLETE THE CODE.` }
          ],
        }],
      }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'API failed' });
    }

    const data = await response.json();
    let code = data.content?.[0]?.text || '';
    code = code.replace(/```javascript\n?/gi, '').replace(/```js\n?/gi, '').replace(/```\n?/g, '').trim();

    return res.status(200).json({ success: true, figmaCode: code });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
