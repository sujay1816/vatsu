// Vercel Serverless Function — Gemini API Proxy
// Place this file at: api/chat.js in your repository root
// Your GEMINI_API_KEY stays on the server — never exposed to the browser

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, context } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
  }

  // Build the full prompt: system context + user message
  const fullPrompt = context
    ? `${context}\n\nUser question: ${message}`
    : message;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: fullPrompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 400,
            temperature: 0.7,
          }
        })
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errData?.error?.message || `Gemini API error ${response.status}`
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(500).json({ error: "Empty response from Gemini" });
    }

    return res.status(200).json({ reply: text });

  } catch (err) {
    return res.status(500).json({ error: "Failed to reach Gemini: " + err.message });
  }
}
