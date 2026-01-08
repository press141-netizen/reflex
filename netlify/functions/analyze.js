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
    const { image, componentName } = JSON.parse(event.body);

    if (!image) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Image is required' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    const requestBody = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: image },
          },
          {
            type: 'text',
            text: `Analyze this UI screenshot and generate Figma Plugin API code to recreate it.

CRITICAL RULES:
1. Return ONLY valid JavaScript code - no markdown, no explanations, no code blocks
2. MUST start with this exact pattern (async IIFE with font loading):

(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

3. Use component name: "${componentName || 'GeneratedComponent'}"
4. Analyze colors, layout, spacing, typography from the image
5. Use Auto Layout where appropriate (layoutMode, padding, itemSpacing)
6. For ALL text nodes, use ONLY Inter font with one of these styles: "Regular", "Medium", "Semi Bold", "Bold"
7. Set fontName BEFORE setting characters: textNode.fontName = { family: "Inter", style: "Regular" };

8. MUST end with:
  figma.currentPage.appendChild(component);
  figma.currentPage.selection = [component];
  figma.viewport.scrollAndZoomIntoView([component]);
  console.log("✅ Component created!");
})();

Example structure:
(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
  
  const component = figma.createComponent();
  component.name = "${componentName || 'GeneratedComponent'}";
  // ... rest of code
  
  figma.currentPage.appendChild(component);
  figma.currentPage.selection = [component];
  figma.viewport.scrollAndZoomIntoView([component]);
  console.log("✅ Component created!");
})();`
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
      return { statusCode: apiResponse.statusCode, headers, body: JSON.stringify({ error: 'API failed', details: apiResponse.body }) };
    }

    let figmaCode = apiResponse.body.content?.[0]?.text || '';
    
    // Clean up markdown code blocks if present
    figmaCode = figmaCode.replace(/```javascript\n?/g, '').replace(/```\n?/g, '').trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, figmaCode }),
    };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
