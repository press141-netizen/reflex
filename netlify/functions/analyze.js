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
            text: `You are an expert Figma Plugin developer. Analyze this UI screenshot (${width}x${height}px) and generate PRECISE Figma Plugin API code to recreate it as accurately as possible.

CRITICAL REQUIREMENTS:

1. OUTPUT FORMAT:
- Return ONLY valid JavaScript code
- NO markdown code blocks, NO explanations
- Must start with: (async () => {
- Must end with: })();

2. FONT LOADING (REQUIRED AT START):
(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

3. COMPONENT SETUP:
  const component = figma.createComponent();
  component.name = "${componentName || 'GeneratedComponent'}";
  component.resize(${width}, ${height});

4. COLOR ACCURACY (VERY IMPORTANT):
- Extract EXACT colors from the image
- Use precise RGB values (0-1 range): { r: 0.98, g: 0.98, b: 0.98 }
- Common colors to look for:
  - Pure white: { r: 1, g: 1, b: 1 }
  - Light gray background: { r: 0.98, g: 0.98, b: 0.99 } or { r: 0.96, g: 0.96, b: 0.97 }
  - Text dark: { r: 0.1, g: 0.1, b: 0.12 }
  - Text medium: { r: 0.4, g: 0.4, b: 0.45 }
  - Blue accent: { r: 0.2, g: 0.4, b: 0.95 }
  - Border light: { r: 0.9, g: 0.9, b: 0.92 }

5. LAYOUT STRUCTURE:
- Use Auto Layout for all containers:
  frame.layoutMode = "HORIZONTAL" or "VERTICAL";
  frame.primaryAxisSizingMode = "FIXED" or "AUTO"; // ONLY these two values! NEVER use "FILL_CONTAINER"
  frame.counterAxisSizingMode = "FIXED" or "AUTO"; // ONLY these two values! NEVER use "FILL_CONTAINER"
  frame.primaryAxisAlignItems = "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  frame.counterAxisAlignItems = "MIN" | "CENTER" | "MAX";
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 16;
  frame.itemSpacing = 12;
  
IMPORTANT: For sizing modes, ONLY use "FIXED" or "AUTO". 
- "FIXED" = explicit size set by resize()
- "AUTO" = size determined by children (hug contents)
- NEVER use "FILL_CONTAINER" - it will cause an error!

6. BACKGROUNDS & BORDERS:
- Cards should have WHITE background: fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
- Add subtle borders: strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92 } }]; strokeWeight = 1;
- Add corner radius: cornerRadius = 8; or cornerRadius = 12;
- Add shadows for cards:
  effects = [{
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.08 },
    offset: { x: 0, y: 2 },
    radius: 8,
    visible: true,
    blendMode: 'NORMAL'
  }];

7. TEXT NODES:
- Set fontName BEFORE characters:
  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Medium" };
  text.characters = "Your text here";
  text.fontSize = 14;
  text.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.12 } }];

8. ICONS (Important):
- For icons, create recognizable placeholder shapes
- Use rectangles or ellipses with appropriate colors
- Add descriptive names: icon.name = "Icon_Refresh";
- Match the approximate size of icons in the image

9. BUTTONS:
- White background with border for outlined buttons
- Include hover states styling
- Proper padding and border-radius

10. SPACING & SIZING:
- Measure spacing carefully from the image
- Use consistent spacing values (4, 8, 12, 16, 20, 24, 32)
- Match element sizes as closely as possible

11. FINAL CODE (REQUIRED):
  figma.currentPage.appendChild(component);
  figma.currentPage.selection = [component];
  figma.viewport.scrollAndZoomIntoView([component]);
  console.log("✅ Component '${componentName || 'GeneratedComponent'}' created!");
})();

IMPORTANT: Look carefully at the image and reproduce:
- Exact background colors (white vs gray)
- Card styling with proper backgrounds, borders, shadows
- Text colors and weights
- Button styles
- Spacing between elements
- Border radius values

Generate the complete Figma Plugin API code now:`
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
