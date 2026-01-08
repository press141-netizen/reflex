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
    const width = imageWidth || 800;
    const height = imageHeight || 600;

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
            text: `You are a Figma expert. Analyze this UI and generate Figma Plugin API code.

STEP 1 - ANALYZE THE LAYOUT:
- How many columns? (1, 2, 3?)
- How many rows?
- What elements are in each cell?

STEP 2 - IDENTIFY ELEMENTS:
- Headers/titles (text)
- Buttons (with borders or filled)
- Input fields
- Images/icons (use rectangles as placeholders)
- Labels

STEP 3 - GENERATE CODE:

(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });

  const component = figma.createComponent();
  component.name = "${componentName || 'GeneratedComponent'}";
  component.resize(${width}, ${height});
  component.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  component.layoutMode = "VERTICAL";
  component.paddingTop = component.paddingBottom = component.paddingLeft = component.paddingRight = 16;
  component.itemSpacing = 12;
  component.primaryAxisSizingMode = "AUTO";
  component.counterAxisSizingMode = "FIXED";

  // === YOUR CODE HERE ===

  figma.currentPage.appendChild(component);
  figma.currentPage.selection = [component];
  figma.viewport.scrollAndZoomIntoView([component]);
  console.log("✅ Done! Adjust in Figma as needed.");
})();

RULES:
1. Return ONLY JavaScript code - NO markdown, NO explanations
2. Use layoutMode "HORIZONTAL" for rows, "VERTICAL" for columns
3. ONLY use "FIXED" or "AUTO" for sizing (NEVER "FILL_CONTAINER")
4. Set fontName BEFORE characters

ELEMENT STYLES:

// Row container (horizontal layout)
const row = figma.createFrame();
row.layoutMode = "HORIZONTAL";
row.itemSpacing = 16;
row.fills = [];
row.primaryAxisSizingMode = "AUTO";
row.counterAxisSizingMode = "AUTO";

// Text
const text = figma.createText();
text.fontName = { family: "Inter", style: "Medium" };
text.characters = "Label";
text.fontSize = 14;
text.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];

// Button with border (outlined)
const btn = figma.createFrame();
btn.layoutMode = "HORIZONTAL";
btn.paddingTop = btn.paddingBottom = 8;
btn.paddingLeft = btn.paddingRight = 16;
btn.cornerRadius = 4;
btn.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
btn.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
btn.strokeWeight = 1;

// Filled button (like 파일업로드)
const filledBtn = figma.createFrame();
filledBtn.layoutMode = "HORIZONTAL";
filledBtn.paddingTop = filledBtn.paddingBottom = 8;
filledBtn.paddingLeft = filledBtn.paddingRight = 16;
filledBtn.cornerRadius = 4;
filledBtn.fills = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }];

// Image placeholder
const imgPlaceholder = figma.createRectangle();
imgPlaceholder.resize(80, 80);
imgPlaceholder.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
imgPlaceholder.cornerRadius = 4;

// Input field
const input = figma.createFrame();
input.layoutMode = "HORIZONTAL";
input.resize(200, 36);
input.paddingLeft = input.paddingRight = 12;
input.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
input.strokes = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }];
input.strokeWeight = 1;
input.cornerRadius = 4;

Now analyze the image and generate the code:`
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
