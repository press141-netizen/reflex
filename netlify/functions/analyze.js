exports.handler = async (event) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { image, componentName } = JSON.parse(event.body);

    if (!image) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Image is required' }),
      };
    }

    // Anthropic API 호출
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: image,
                },
              },
              {
                type: 'text',
                text: `You are a Figma Plugin API expert. Analyze this UI screenshot and generate Figma Plugin API code to recreate it.

IMPORTANT RULES:
1. Return ONLY valid JavaScript code - no markdown, no explanations, no code blocks
2. Start directly with: const component = figma.createComponent();
3. Use component name: "${componentName || 'GeneratedComponent'}"
4. Analyze the exact layout, colors, typography, spacing, and shadows from the image
5. Use proper Auto Layout (layoutMode, padding, itemSpacing, primaryAxisAlignItems, counterAxisAlignItems)
6. Extract actual colors from the image and use them (convert to RGB 0-1 format)
7. Include all visible text elements
8. Add appropriate corner radius and effects (shadows, etc.)
9. Load fonts with: await figma.loadFontAsync({ family: "Inter", style: "Regular" });

End the code with:
component.x = figma.viewport.center.x - component.width / 2;
component.y = figma.viewport.center.y - component.height / 2;
figma.currentPage.selection = [component];
figma.viewport.scrollAndZoomIntoView([component]);
console.log("✅ Component '${componentName || 'GeneratedComponent'}' created successfully!");`
              }
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'AI API request failed', details: errorData }),
      };
    }

    const data = await response.json();
    const figmaCode = data.content?.[0]?.text || '';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        figmaCode: figmaCode,
      }),
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
