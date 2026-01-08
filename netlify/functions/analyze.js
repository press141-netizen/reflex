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

    const width = imageWidth || 400;
    const height = imageHeight || 300;
    const mime = mimeType || 'image/png';

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: image } },
          { type: 'text', text: `Generate Figma code for this UI. Size: ${width}x${height}px.

Return ONLY JavaScript:

(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const frame = figma.createFrame();
  frame.name = "${componentName || 'Frame'}";
  frame.resize(${width}, ${height});
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  frame.layoutMode = "VERTICAL";
  frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = 12;
  frame.itemSpacing = 8;
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
  
  // Add elements here
  
  figma.currentPage.appendChild(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);
})();

Rules:
- NO markdown, code only
- Use figma.createFrame() for containers
- Use figma.createText() for text (set fontName before characters)
- Match colors from image
- Use "FIXED" or "AUTO" for sizing (never "FILL_CONTAINER")` }
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
      req.setTimeout(25000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(requestBody);
      req.end();
    });

    if (apiResponse.statusCode !== 200) {
      return { statusCode: apiResponse.statusCode, headers, body: JSON.stringify({ error: 'API failed' }) };
    }

    let code = apiResponse.body.content?.[0]?.text || '';
    code = code.replace(/```javascript\n?/gi, '').replace(/```js\n?/gi, '').replace(/```\n?/g, '').trim();

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, figmaCode: code }) };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
