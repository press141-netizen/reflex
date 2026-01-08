export const config = {
  maxDuration: 60, // 60초 타임아웃
};

export default async function handler(req, res) {
  // CORS
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
            { type: 'text', text: `Generate Figma code for this UI. Size: ${width}x${height}px.

ANALYZE THE LAYOUT CAREFULLY:
1. Count rows and columns
2. If buttons are in a 2x2 grid, create 2 horizontal rows with 2 buttons each
3. Match the exact structure

Return ONLY JavaScript:

(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  
  const frame = figma.createFrame();
  frame.name = "${componentName || 'Frame'}";
  frame.resize(${width}, ${height});
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  frame.layoutMode = "VERTICAL";
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 16;
  frame.itemSpacing = 12;
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  
  // Add elements...
  
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();

LAYOUT PATTERNS:

// 2-column header row
const headerRow = figma.createFrame();
headerRow.layoutMode = "HORIZONTAL";
headerRow.primaryAxisSizingMode = "FIXED";
headerRow.counterAxisSizingMode = "AUTO";
headerRow.resize(${width - 32}, 30);
headerRow.itemSpacing = 16;
headerRow.fills = [];

// 2x2 button grid = 2 rows, each with 2 buttons
const buttonRow = figma.createFrame();
buttonRow.layoutMode = "HORIZONTAL";
buttonRow.itemSpacing = 8;
buttonRow.fills = [];

// Outlined button (white bg + border)
const outlinedBtn = figma.createFrame();
outlinedBtn.layoutMode = "HORIZONTAL";
outlinedBtn.primaryAxisSizingMode = "AUTO";
outlinedBtn.counterAxisSizingMode = "AUTO";
outlinedBtn.paddingTop = outlinedBtn.paddingBottom = 8;
outlinedBtn.paddingLeft = outlinedBtn.paddingRight = 16;
outlinedBtn.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
outlinedBtn.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
outlinedBtn.strokeWeight = 1;
outlinedBtn.cornerRadius = 4;

// Filled button (gray background, NO border)
const filledBtn = figma.createFrame();
filledBtn.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
filledBtn.strokes = [];

// Blue text link
text.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.9 } }];

Rules:
- NO markdown, code only
- Set fontName BEFORE characters
- Use "FIXED" or "AUTO" for sizing (NEVER "FILL_CONTAINER")
- Match button grid layout exactly (2x2 = 2 rows of 2)` }
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
