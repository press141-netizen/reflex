const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { image, componentName, mimeType, imageWidth, imageHeight } = JSON.parse(event.body);

    if (!image) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Image is required' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    const actualMimeType = mimeType || 'image/png';
    const width = imageWidth || 400;
    const height = imageHeight || 300;

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: actualMimeType, data: image },
          },
          {
            type: 'text',
            text: `Analyze this UI screenshot and generate Figma Plugin API code.

IMAGE SIZE: ${width}px × ${height}px
Keep this exact width and height ratio!

CRITICAL RULES:
1. Return ONLY JavaScript code - NO markdown, NO explanations
2. Create a FRAME (not component): figma.createFrame()
3. Use Auto Layout for everything
4. Match the WIDTH and HEIGHT proportions from the image
5. ONLY use "FIXED" or "AUTO" for sizing modes
6. MATCH EXACT COLORS from the image - look carefully at text colors, backgrounds, borders

COLOR MATCHING (IMPORTANT):
- Look at each text element and match its EXACT color
- If text is BLUE/PURPLE, use blue: { r: 0.4, g: 0.4, b: 0.9 } or similar
- If text is GRAY, use gray: { r: 0.5, g: 0.5, b: 0.55 }
- If text is BLACK, use: { r: 0.1, g: 0.1, b: 0.1 }
- Match border colors exactly (light gray, blue, etc.)
- Match background colors exactly

CODE STRUCTURE:

(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });

  // Main frame - USE EXACT IMAGE DIMENSIONS
  const frame = figma.createFrame();
  frame.name = "${componentName || 'GeneratedFrame'}";
  frame.resize(${width}, ${height});
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 12;
  frame.itemSpacing = 8;

  // Add child elements here...

  figma.currentPage.appendChild(frame);
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);
  console.log("✅ Frame created!");
})();

ELEMENT PATTERNS:

// Horizontal row
const row = figma.createFrame();
row.name = "Row";
row.layoutMode = "HORIZONTAL";
row.primaryAxisSizingMode = "AUTO";
row.counterAxisSizingMode = "AUTO";
row.itemSpacing = 8;
row.fills = [];

// Text label - MATCH COLOR FROM IMAGE
const label = figma.createText();
label.fontName = { family: "Inter", style: "Regular" };
label.characters = "Text";
label.fontSize = 13;
// Use the EXACT color from the image:
// - Blue/purple text: { r: 0.4, g: 0.45, b: 0.85 }
// - Gray text: { r: 0.5, g: 0.5, b: 0.55 }
// - Black text: { r: 0.1, g: 0.1, b: 0.15 }
label.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.55 } }];

// Button with border
const btn = figma.createFrame();
btn.name = "Button";
btn.layoutMode = "HORIZONTAL";
btn.primaryAxisSizingMode = "AUTO";
btn.counterAxisSizingMode = "AUTO";
btn.paddingTop = btn.paddingBottom = 6;
btn.paddingLeft = btn.paddingRight = 12;
btn.cornerRadius = 4;
btn.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
btn.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
btn.strokeWeight = 1;
// Add text to button
const btnText = figma.createText();
btnText.fontName = { family: "Inter", style: "Medium" };
btnText.characters = "Button";
btnText.fontSize = 12;
btn.appendChild(btnText);

// Filled button (gray background)
const filledBtn = figma.createFrame();
filledBtn.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];

// Icon placeholder (circle or square)
const icon = figma.createEllipse();
icon.resize(16, 16);
icon.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];

// Folder icon (rectangle)
const folder = figma.createRectangle();
folder.resize(16, 14);
folder.fills = [{ type: 'SOLID', color: { r: 0.3, g: 0.5, b: 0.9 } }];
folder.cornerRadius = 2;

// Input/Search field
const input = figma.createFrame();
input.layoutMode = "HORIZONTAL";
input.primaryAxisSizingMode = "FIXED";
input.counterAxisSizingMode = "AUTO";
input.resize(200, 32);
input.paddingLeft = input.paddingRight = 10;
input.paddingTop = input.paddingBottom = 6;
input.cornerRadius = 4;
input.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
input.strokes = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }];
input.strokeWeight = 1;

IMPORTANT:
- Estimate element sizes based on proportions in the image
- If image is 240px wide with 2 columns, each column ~100px
- Match padding and spacing visually
- Use fills = [] for transparent containers
- CRITICAL: Match EXACT text colors from the image (blue, gray, black, etc.)
- If border is dashed in image, use solid border with light color as approximation

Generate the code now:`
          }
        ],
      }],
    });

    const apiResponse = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    if (apiResponse.statusCode !== 200) {
      console.error('API Error:', JSON.stringify(apiResponse.body));
      return { statusCode: apiResponse.statusCode, headers, body: JSON.stringify({ error: 'API failed', details: apiResponse.body }) };
    }

    let figmaCode = apiResponse.body.content?.[0]?.text || '';
    
    // Clean up markdown code blocks if present
    figmaCode = figmaCode.replace(/```javascript\n?/gi, '').replace(/```js\n?/gi, '').replace(/```\n?/g, '').trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, figmaCode }),
    };

  } catch (error) {
    console.error('Function error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
