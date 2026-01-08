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
            text: `Analyze this UI screenshot and generate Figma Plugin API code that creates the BASIC STRUCTURE.

Your goal: Create a starting point that the user will manually refine in Figma.

OUTPUT FORMAT - Return ONLY this JavaScript code structure:

(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });

  const component = figma.createComponent();
  component.name = "${componentName || 'GeneratedComponent'}";
  component.resize(${width}, ${height});
  component.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  // Create frames and elements here...

  figma.currentPage.appendChild(component);
  figma.currentPage.selection = [component];
  figma.viewport.scrollAndZoomIntoView([component]);
  console.log("✅ Basic structure created! Adjust colors and spacing in Figma.");
})();

RULES:
1. NO markdown, NO explanations - ONLY JavaScript code
2. Focus on STRUCTURE: frames, text nodes, basic shapes
3. Use simple placeholder colors (white backgrounds, gray borders, dark text)
4. Use Auto Layout with layoutMode "HORIZONTAL" or "VERTICAL"
5. ONLY use "FIXED" or "AUTO" for sizing modes (NEVER "FILL_CONTAINER")
6. Set fontName BEFORE characters for all text nodes
7. Extract and include ALL text content from the image
8. Create the correct NUMBER of elements (cards, buttons, icons)

SIMPLE DEFAULTS TO USE:
- Backgrounds: { r: 1, g: 1, b: 1 } (white)
- Text: { r: 0.2, g: 0.2, b: 0.2 } (dark gray)
- Borders: { r: 0.9, g: 0.9, b: 0.9 } (light gray)
- cornerRadius: 8 or 12
- Icons: Use figma.createEllipse() as placeholders

The user will adjust exact colors and spacing manually. Focus on getting the structure right.

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
