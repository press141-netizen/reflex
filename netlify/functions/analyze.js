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
            text: `Generate Figma Plugin API code to recreate this UI screenshot exactly.

RULES:
1. Return ONLY JavaScript code - NO markdown, NO explanations
2. Use this exact structure:

(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });

  const component = figma.createComponent();
  component.name = "${componentName || 'GeneratedComponent'}";
  component.resize(${width}, ${height});
  component.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // WHITE background

  // YOUR CODE HERE - recreate all UI elements

  figma.currentPage.appendChild(component);
  figma.currentPage.selection = [component];
  figma.viewport.scrollAndZoomIntoView([component]);
})();

CRITICAL STYLE RULES:
- Main background: WHITE { r: 1, g: 1, b: 1 }
- Cards: WHITE background + border + shadow + cornerRadius: 12
  card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  card.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92 } }];
  card.strokeWeight = 1;
  card.cornerRadius = 12;
  card.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.08 }, offset: { x: 0, y: 2 }, radius: 8, visible: true, blendMode: 'NORMAL' }];

- Buttons with border: WHITE background + gray border + cornerRadius: 8
- Text: Set fontName BEFORE characters
  text.fontName = { family: "Inter", style: "Medium" };
  text.characters = "text";
  
- Icons: Use figma.createEllipse() for circular icons
- Sizing: ONLY use "FIXED" or "AUTO" for primaryAxisSizingMode/counterAxisSizingMode (NEVER "FILL_CONTAINER")

Look at the image carefully and match:
- Exact colors (backgrounds should be WHITE if they look white)
- All text content
- Layout and spacing
- Number of elements (cards, icons, buttons)

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
