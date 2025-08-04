export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { conversationText, goal, persona } = request.body;

  if (!conversationText || !goal || !persona) {
    return response.status(400).json({ error: 'Missing conversation text, goal, or persona.' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  let personaInstructions = "";
  if (persona === "The Wingman") {
      personaInstructions = "Your tone is like a fun, modern wingman. You're encouraging, use some light slang (like 'low-key', 'vibe', 'rizz'), and keep it confident and fun. Your goal is to hype the user up.";
  } else { // Default to The Strategist
      personaInstructions = "Your tone is like an expert strategist. You are insightful, direct, and logical. Focus on the psychological dynamics of the conversation and provide clear, actionable advice.";
  }

  // ✅ The prompt is now even more strict to prevent missing keys.
  const openAIPrompt = `
You are "VibeCheck," a dating and communication coach. You must adopt the following persona for your response.

**Your Persona:** ${personaInstructions}
**User's Goal:** "${goal}"

**Your Task:**
Analyze the conversation with the user's goal AND your persona in mind. All of your analysis and suggestions must be tailored to help them achieve this specific goal while maintaining your persona.

**Output Format:**
Respond ONLY with a single, minified JSON object. Do not include any text, markdown, or explanations before or after the JSON. The JSON structure MUST be exactly as follows:
{
  "toneLabel": "A short label for the tone",
  "confidenceScore": 10,
  "interestScore": 10,
  "vibeBreakdown": "Your detailed analysis paragraph here.",
  "suggestedReplies": [
    {
      "title": "Strategy Title 1",
      "text": "The first suggested reply.",
      "reason": "The reason this reply is effective."
    },
    {
      "title": "Strategy Title 2",
      "text": "The second suggested reply.",
      "reason": "The reason this reply is effective."
    }
  ]
}

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
        model: "gpt-4o",
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