export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { conversationText, goal, persona } = request.body;

  if (!conversationText || !goal || !persona) {
    return response.status(400).json({ error: 'Missing conversation text, goal, or persona.' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_AI_KEY;

  let personaInstructions = "";
  switch (persona) {
    case "The Wingman":
      personaInstructions = "Your tone is like a fun, modern wingman. You're encouraging, use some light UK slang (like 'cheers', 'mate', 'gutted'), and keep it confident and fun. Your goal is to hype the user up.";
      break;
    case "The Comedian":
      personaInstructions = "Your tone is like a witty, sarcastic stand-up comedian. Focus on finding the humour in the situation. Your replies should be clever, playful, and aim to make the other person laugh. Puns and light-hearted roasts are encouraged.";
      break;
    case "The Rebel":
      personaInstructions = "Your tone is brutally honest, sarcastic, and unfiltered. You have a 'don't give a damn' attitude. Your advice should be blunt, dismissive, and even confrontational. IMPORTANT: For the 'reason' in your suggested replies, you MUST include a warning about the potential negative consequences of using such a bold reply (e.g., 'Warning: This is aggressive and might end the conversation.').";
      break;
    default: // The Strategist
      personaInstructions = "Your tone is like an expert strategist. You are insightful, direct, and logical. Focus on the psychological dynamics of the conversation and provide clear, actionable advice.";
      break;
  }

  const openAIPrompt = `
You are "VibeGPT," a world-renowned communication strategist specializing in the subconscious signals of digital attraction.

**Your Persona:** ${personaInstructions}
**User's Goal:** "${goal}"
**Language and Region:** British English.

**Your Task:**
Perform a deep, multi-layered analysis of the conversation from the perspective of "Me". Your analysis must be framed through established psychological principles.

**Output Format:**
Respond ONLY with a single, minified JSON object. The structure MUST be exactly as follows, and you MUST provide EXACTLY 3 suggested replies, each representing a different level of risk.
{
  "toneLabel": "A short label for the tone",
  "confidenceScore": 10,
  "interestScore": 10,
  "powerDynamic": "A brief assessment (e.g., 'You're Pursuing', 'They're Pursuing', 'Balanced').",
  "strategicAnalysis": "A detailed paragraph explaining the subtext, key moments, and overall strategy to achieve the user's goal.",
  "suggestedReplies": [
    { 
      "title": "Low Risk: The Safe Play", 
      "text": "The first suggested reply.", 
      "reason": "Explain the psychological tactic here (e.g., 'This uses playful misinterpretation to build comfort.').",
      "riskLevel": "Low",
      "potentialOutcome": "A short prediction of their likely positive response."
    },
    { 
      "title": "Medium Risk: The Bold Move", 
      "text": "The second suggested reply.", 
      "reason": "Explain the psychological tactic here (e.g., 'This creates scarcity by implying you have other options.').",
      "riskLevel": "Medium",
      "potentialOutcome": "A short prediction of their likely positive response."
    },
    { 
      "title": "High Risk: The Game Changer", 
      "text": "The third suggested reply.", 
      "reason": "Explain the psychological tactic here (e.g., 'This is a direct challenge that forces a clear show of interest.').",
      "riskLevel": "High",
      "potentialOutcome": "A short prediction of their likely positive response."
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
