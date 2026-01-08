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
    const { image, componentName, mimeType } = JSON.parse(event.body);

    const safeMimeType = (() => {
      const allowed = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
      if (!mimeType) return 'image/png';
      const mt = String(mimeType).toLowerCase();
      return allowed.has(mt) ? (mt === 'image/jpg' ? 'image/jpeg' : mt) : 'image/png';
    })();


    if (!image) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Image is required' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set');
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ error: 'API key not configured' }) 
      };
    }

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: safeMimeType,
              data: image,
            },
          },
          {
            type: 'text',
            text: `Analyze this UI screenshot and generate Figma Plugin API code to recreate it.

Return ONLY valid JavaScript code, no markdown, no explanations.
Start with: const component = figma.createComponent();
Use component name: "${componentName || 'GeneratedComponent'}"

End with:
figma.currentPage.selection = [component];
figma.viewport.scrollAndZoomIntoView([component]);
console.log("✅ Component created!");`
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
      console.error('API Error:', apiResponse.body);
      return {
        statusCode: apiResponse.statusCode,
        headers,
        body: JSON.stringify({ error: 'AI API request failed', details: apiResponse.body }),
      };
    }

    const figmaCode = apiResponse.body.content?.[0]?.text || '';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, figmaCode }),
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
};
