export default async function handler(request, response) {
  // --- Security & Input Validation ---
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { conversationText, goal, persona } = request.body;

  if (!conversationText) {
    return response.status(400).json({ error: 'No conversation text provided.' });
  }

  if (conversationText.length > 2000) {
    return response.status(413).json({ error: 'Conversation text exceeds the 2000 character limit.' });
  }

  // --- AI Prompt Engineering ---
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  let personaInstructions = "Your persona is the 'Direct'. Your tone is insightful, modern, and empowering. You analyze the conversation through a psychological lens and provide direct, logical advice.";
  
  if (persona === "Wingman 🔥") {
      personaInstructions = "Your persona is the 'Wingman'. Your tone is fun, encouraging, and playful. You're here to hype the user up and give them charismatic, confident lines.";
  } else if (persona === "Joker 😂") {
      personaInstructions = "Your persona is the 'Joker'. Your tone is witty and humorous. Your goal is to provide funny, clever, and unexpected replies that are designed to make the other person laugh.";
  } else if (persona === "Rebel 😈") {
      personaInstructions = "Your persona is the 'Rebel'. Your tone is brutally honest, edgy, and high-risk. You provide unfiltered, bold advice that cuts straight to the point. IMPORTANT: Always include a 'Consequence' key in your reply objects, explaining the potential negative outcome of such a bold move.";
  }

  const openAIProm-pt = `
    You are "VibeCheck," an expert dating and communication coach using British English.
    
    **Persona:**
    ${personaInstructions}

    **User's Goal:**
    The user's primary goal for this interaction is: "${goal}". Tailor your analysis and suggestions to help them achieve this.

    **Conversation Analysis Instructions:**
    Analyze the following conversation from the user's perspective (they are "Me").
    1.  **Strategic Analysis:** Write a concise paragraph (2-4 sentences) explaining the dynamic of the conversation. Incorporate psychological principles (e.g., scarcity, social proof, power dynamics). This is the 'strategicAnalysis'.
    2.  **Power Dynamic:** State who has the upper hand or if it's balanced. This is the 'powerDynamic'.
    3.  **Scores:** Provide a 'confidenceScore' and 'interestScore' from the other person's perspective (scale of 1-10).
    4.  **Strategic Replies:** Generate an array of exactly 3 distinct suggested replies. Each reply object in the array must have these keys: 'title' (a catchy name for the strategy), 'text' (the suggested reply), 'reason' (why this approach is effective), 'riskLevel' (Low, Medium, or High), and 'potentialOutcome' (the likely result of this reply).

    **Output Format:**
    Respond ONLY with a single, minified JSON object. Do not include any text before or after the JSON.
    Example Format: {"strategicAnalysis":"...","powerDynamic":"...","confidenceScore":7,"interestScore":8,"suggestedReplies":[{"title":"...","text":"...","reason":"...","riskLevel":"...","potentialOutcome":"..."}, ...]}

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
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: openAIPrompt }],
        response_format: { type: "json_object" },
        max_tokens: 400 // ✅ COST CONTROL: Hard limit on response length
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

