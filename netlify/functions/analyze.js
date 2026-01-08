const https = require('https');

// Netlify Function: /.netlify/functions/analyze
// Proxies a UI screenshot to Anthropic and returns runnable Figma Plugin API code.
// Safety: post-process model output to enforce async wrapper + font loading order.

function normalizeMimeType(mimeType) {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
  if (!mimeType) return 'image/png';
  const mt = String(mimeType).toLowerCase();
  if (!allowed.has(mt)) return 'image/png';
  return mt === 'image/jpg' ? 'image/jpeg' : mt;
}

function extractInterStyles(jsCode) {
  const styles = new Set();
  const re = /family\s*:\s*["']Inter["']\s*,\s*style\s*:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(jsCode)) !== null) {
    const style = (m[1] || '').trim();
    if (style) styles.add(style);
  }

  // Always include safe defaults
  styles.add('Regular');
  styles.add('Medium');

  return Array.from(styles);
}

function ensureAsyncIIFE(jsCode) {
  const trimmed = String(jsCode || '').trim();
  if (!trimmed) return '(async () => {})();';

  // Detect if already wrapped in an async IIFE.
  const alreadyWrapped = /^\(\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*\}\s*\)\s*\(\s*\)\s*;?\s*$/.test(trimmed);
  if (alreadyWrapped) return trimmed;

  return `
(async () => {
${trimmed}
})();
`.trim();
}

function injectFontLoads(jsCode, styles) {
  const code = String(jsCode || '');
  const loadLines = styles
    .map((style) => `  await figma.loadFontAsync({ family: "Inter", style: "${style}" });`)
    .join('\n');

  // If code is an async IIFE, inject right after the first opening brace.
  // Otherwise, we'll wrap later.
  if (/^\(\s*async\s*\(\s*\)\s*=>\s*\{/.test(code.trim())) {
    // Avoid duplicating identical load lines if they already exist
    const alreadyHasRegular = /loadFontAsync\(\s*\{\s*family\s*:\s*["']Inter["']\s*,\s*style\s*:\s*["']Regular["']\s*\}\s*\)/.test(code);
    const alreadyHasMedium = /loadFontAsync\(\s*\{\s*family\s*:\s*["']Inter["']\s*,\s*style\s*:\s*["']Medium["']\s*\}\s*\)/.test(code);
    if (alreadyHasRegular && alreadyHasMedium) {
      return code;
    }

    return code.replace(
      /^(\(\s*async\s*\(\s*\)\s*=>\s*\{\s*)/,
      `$1\n${loadLines}\n`
    );
  }

  // Not wrapped yet — just prepend loads at the top (wrapper will be added later).
  return `${loadLines}\n${code}`;
}

function postProcessFigmaCode(rawCode) {
  let code = String(rawCode || '').trim();

  // Remove accidental Markdown fences if the model included them.
  code = code.replace(/^```[a-zA-Z]*\s*/g, '').replace(/```\s*$/g, '').trim();

  const styles = extractInterStyles(code);
  code = injectFontLoads(code, styles);
  code = ensureAsyncIIFE(code);

  return code;
}

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
    const { image, componentName, mimeType } = JSON.parse(event.body || '{}');

    if (!image) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Image is required' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY is not set');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured' }),
      };
    }

    const safeMimeType = normalizeMimeType(mimeType);
    const safeName = componentName || 'GeneratedComponent';

    const prompt = `You are generating JavaScript for a Figma plugin (Figma Plugin API).

CRITICAL RULES (must follow exactly):
1) Output MUST be pure JavaScript code only. No markdown, no explanations, no comments.
2) Wrap the ENTIRE output in an async IIFE:
   (async () => { /* code */ })();
   Do NOT use top-level await outside the IIFE.
3) BEFORE creating ANY text node (figma.createText) OR setting any text font (text.fontName),
   you MUST call and await figma.loadFontAsync for that exact font.
4) Use Inter as the only font family.
   If you use any style other than Regular/Medium (e.g. Semi Bold/Bold), you MUST load it too.
5) Create a component named "${safeName}".
   The code MUST define: const component = figma.createComponent();
   and set: component.name = "${safeName}";
6) End with the following exact lines:
   figma.currentPage.appendChild(component);
   figma.currentPage.selection = [component];
   figma.viewport.scrollAndZoomIntoView([component]);
   console.log("✅ Component created!");

TASK:
Analyze this UI screenshot and generate Figma Plugin API code to recreate it as closely as reasonable.
Prefer Auto Layout where appropriate. Use rectangles with fills/strokes, text nodes, and simple layout.
Keep the code robust and runnable.`;

    const requestBody = JSON.stringify({
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
                media_type: safeMimeType,
                data: image,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const apiResponse = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Length': Buffer.byteLength(requestBody),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
            } catch (e) {
              resolve({ statusCode: res.statusCode, body: data });
            }
          });
        }
      );

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

    const rawFigmaCode = apiResponse.body?.content?.[0]?.text || '';
    const figmaCode = postProcessFigmaCode(rawFigmaCode);

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
