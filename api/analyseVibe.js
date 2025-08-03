export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { conversationText } = request.body;
  if (!conversationText) {
    return response.status(400).json({ error: 'No conversation text provided.' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const openAIPrompt = `
You are "VibeCheck," an expert dating and communication coach. Your tone is insightful, modern, and empowering. Analyse the following conversation for a user.

**Analysis Steps:**
1.  **Initial Assessment:** Read the conversation and determine the overall tone (e.g., flirty, friendly, hesitant, formal).
2.  **Score Calculation:** Provide a 'confidenceScore' and an 'interestScore' from the other person's perspective (scale of 1-10).
3.  **Vibe Breakdown:** Write a short paragraph (2-3 sentences) explaining the dynamic of the conversation. Point out any shifts in tone or key phrases. This is the 'vibeBreakdown'.
4.  **Strategic Replies:** Generate an array of 2-3 distinct suggested replies. Each reply object in the array must have three keys: 'title' (a short, catchy name for the strategy, e.g., "The Confident Invite"), 'text' (the suggested reply message), and 'reason' (a brief explanation of why this approach is effective).

**Output Format:**
Respond ONLY with a single, minified JSON object. Do not include any text before or after the JSON. The JSON must have these exact keys: 'toneLabel', 'confidenceScore', 'interestScore', 'vibeBreakdown', and 'suggestedReplies' (which is an array of objects).

**Conversation to Analyze:**
"${conversationText}"
`;

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o", // ✅ UPDATED: Changed from "gpt-4" to a compatible model
        messages: [{ role: "system", content: openAIPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json();
      console.error("OpenAI API Error:", errorData);
      return response.status(openAIResponse.status).json({ error: "OpenAI API returned an error." });
    }

    const data = await openAIResponse.json();
    const contentString = data.choices[0].message.content;

    try {
      const analysisContent = JSON.parse(contentString);
      return response.status(200).json(analysisContent);
    } catch (parseError) {
      console.error("Failed to parse JSON response from OpenAI.");
      console.error("Problematic content:", contentString);
      return response.status(500).json({ error: "Failed to parse AI response." });
    }

  } catch (networkError) {
    console.error("Network error calling OpenAI:", networkError);
    return response.status(500).json({ error: 'Failed to fetch analysis due to a network error.' });
  }
}