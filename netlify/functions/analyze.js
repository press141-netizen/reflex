/**
 * Netlify Function: analyze
 * - Sends screenshot to Anthropic
 * - Returns Figma Plugin JS code (string) to recreate UI
 *
 * Expected body (JSON):
 * {
 *   "image": "<base64-no-dataurl>",
 *   "mimeType": "image/png" | "image/jpeg" | "image/webp",
 *   "componentName": "GeneratedComponent",
 *   "imageWidth": 0,
 *   "imageHeight": 0
 * }
 */
export default async (request, context) => {
  try {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY env var" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json().catch(() => ({}));
    const image = body.image;
    const mimeType = body.mimeType || "image/png";
    const componentName = body.componentName || "GeneratedComponent";
    const imageWidth = Number(body.imageWidth || 0);
    const imageHeight = Number(body.imageHeight || 0);

    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "Missing image (base64)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // A stronger "layout-first" instruction to reduce mismatches.
    const system = `You generate JavaScript code that runs inside a Figma plugin environment.
Output MUST be pure JavaScript code only (no markdown, no backticks, no explanations).

GOAL:
Recreate the provided UI screenshot as a Figma Component as closely as possible.

CRITICAL FIGMA RULES:
- Wrap everything in: (async () => { ... })();
- Before creating or editing ANY Text node (figma.createText, setting characters, fontName), you MUST await figma.loadFontAsync for that font.
- Use ONLY the "Inter" font family.
- Use exact Inter styles used: Regular, Medium, Semi Bold, Bold (Figma naming).
- Prefer Auto Layout frames. Use padding, itemSpacing, and alignment to match screenshot.

FIDELITY RULES (very important):
- Match the overall component size to the screenshot aspect ratio. If image dimensions are provided, use them as the base.
- Match: spacing/padding, corner radius, background fills, strokes, shadows, and text sizes/weights.
- Use realistic values (e.g., radius 12, 16, 20 etc) and consistent spacing scale (4/8/12/16/24/32).
- Create separate frames for header row, title text, and each suggestion card.
- Cards: rounded rectangle background, subtle stroke or shadow if visible, equal height, consistent gaps.
- The icon + label group on the left should align vertically with the title.

OUTPUT REQUIREMENTS:
- Create a component named exactly: ${componentName}
- Append it to the current page, center it in viewport.
- Keep layer names meaningful.
`;

    const userText = `Analyze the screenshot and generate Figma plugin JavaScript to recreate it.
Image size (if provided): ${imageWidth}x${imageHeight}.
If dimensions are 0, choose a reasonable component size close to the screenshot (e.g., width 1200, height proportional).`;

    const anthropicBody = {
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 4096,
      system,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: image,
              },
            },
          ],
        },
      ],
    };

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ error: "Anthropic request failed", detail: txt }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content = data?.content || [];
    const textParts = content.filter((c) => c.type === "text").map((c) => c.text || "");
    let figmaCode = textParts.join("\n").trim();

    // Strip accidental markdown fences if any.
    figmaCode = figmaCode
      .replace(/^```[a-zA-Z]*\n/, "")
      .replace(/\n```$/, "")
      .trim();

    return new Response(JSON.stringify({ figmaCode }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unexpected error", detail: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
