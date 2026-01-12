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
            { type: 'text', text: `Generate Figma Plugin API code to recreate this UI. Size: ${width}x${height}px.

Return ONLY JavaScript code (no markdown, no explanation):

(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  
  const frame = figma.createFrame();
  frame.name = "${componentName || 'GeneratedComponent'}";
  frame.resize(${width}, ${height});
  frame.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.98 } }];
  frame.cornerRadius = 16;
  frame.layoutMode = "VERTICAL";
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 16;
  frame.itemSpacing = 8;
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  
  // Build UI here...
  
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();

ELEMENT PATTERNS TO USE:

// Menu item row (icon + text)
const menuItem = figma.createFrame();
menuItem.name = "MenuItem";
menuItem.layoutMode = "HORIZONTAL";
menuItem.counterAxisAlignItems = "CENTER";
menuItem.itemSpacing = 12;
menuItem.paddingTop = menuItem.paddingBottom = 12;
menuItem.paddingLeft = menuItem.paddingRight = 16;
menuItem.fills = [];
menuItem.primaryAxisSizingMode = "AUTO";
menuItem.counterAxisSizingMode = "AUTO";

// Active/selected menu item (with colored background)
menuItem.fills = [{ type: 'SOLID', color: { r: 0.93, g: 0.95, b: 1 } }];
menuItem.cornerRadius = 8;

// Icon placeholder (square with rounded corners)
const icon = figma.createRectangle();
icon.name = "Icon";
icon.resize(20, 20);
icon.cornerRadius = 4;
icon.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.9 } }];

// Text label
const label = figma.createText();
label.fontName = { family: "Inter", style: "Medium" };
label.characters = "Menu Item";
label.fontSize = 14;
label.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.25 } }];

// Logo (larger rounded rectangle)
const logo = figma.createRectangle();
logo.name = "Logo";
logo.resize(48, 48);
logo.cornerRadius = 12;
logo.fills = [{ type: 'SOLID', color: { r: 0.35, g: 0.4, b: 0.95 } }];

// Card container (white background)
const card = figma.createFrame();
card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
card.cornerRadius = 12;
card.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 2 }, radius: 8, visible: true, blendMode: 'NORMAL' }];

RULES:
- Use "FIXED" or "AUTO" for sizing (NEVER "FILL_CONTAINER")
- Set fontName BEFORE setting characters
- Match colors from image (backgrounds, text, icons)
- Create icon placeholders as rectangles with cornerRadius
- Use layoutMode for all containers` }
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
