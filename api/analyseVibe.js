import { Redis } from '@upstash/redis'
import crypto from "crypto";

// --- CONFIGURATION ---
const PROMPT_VERSION = "1.2"; // Updated version
const DAILY_BUDGET_GBP = 50.00;
const COST_PER_1K_TOKENS_GBP = 0.0006;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ✅ --- DYNAMIC PROMPT GENERATION ---
// This function builds the unique, game-changing prompt based on user selections.
const generatePrompt = (conversation, goal, persona) => {
    let personaInstruction = "";
    switch (persona) {
        case "Direct 🤔":
            personaInstruction = "Your tone is The Strategist: direct, logical, insightful, and confident. Use clear, strategic language and focus on the most effective path to the user's goal.";
            break;
        case "Wingman 🔥":
            personaInstruction = "Your tone is The Wingman: fun, encouraging, high-energy, and playful. Use modern slang, be supportive, and inject a bit of humour. Your goal is to hype the user up.";
            break;
        case "Joker 😂":
            personaInstruction = "Your tone is The Comedian: witty, sarcastic, and clever. Find the humour in the situation and provide genuinely funny replies that are still effective.";
            break;
        case "Rebel 😈":
            personaInstruction = "Your tone is The Rebel: brutally honest, direct, and unfiltered. Use strong language where appropriate. You MUST include a 'consequence' field in your reply objects, warning the user of the potential negative outcome of this high-risk approach.";
            break;
        default:
            personaInstruction = "Your tone is that of a helpful, neutral dating coach.";
    }

    return `
You are "VibeCheck," an expert dating and communication coach. Your analysis must be insightful, modern, and empowering, using British English spelling and colloquialisms.

**Persona Directive:** ${personaInstruction}

**User's Goal:** The user's primary goal for this conversation is to: "${goal}". All of your analysis and suggestions must be aimed at achieving this specific goal.

**Conversation Analysis Steps:**
1.  **Strategic Analysis:** Write a short paragraph (2-4 sentences) explaining the dynamic of the conversation. Incorporate psychological principles (e.g., scarcity, social proof, playful challenge) to explain what's happening.
2.  **Power Dynamic:** State who currently has the upper hand in the conversation (e.g., "User is pursuing", "They are pursuing", "Balanced").
3.  **Scoring:** Provide a 'confidenceScore' and an 'interestScore' from the other person's perspective (scale of 1-10).
4.  **Strategic Replies:** Generate an array of exactly THREE distinct suggested replies. Each reply object in the array must have these keys: 'title' (a catchy name for the strategy), 'text' (the suggested reply message), 'reason' (why this approach is effective for the user's goal), 'riskLevel' (Low, Medium, or High), and 'potentialOutcome' (a likely positive result). If your persona is "The Rebel", you must also include a 'consequence' key.

**Output Format:**
Respond ONLY with a single, minified JSON object. Do not include any text before or after the JSON. The structure must be:
{"strategicAnalysis": "", "powerDynamic": "", "confidenceScore": 0, "interestScore": 0, "suggestedReplies": [{"title":"", "text":"", "reason":"", "riskLevel":"", "potentialOutcome":""}]}

**Conversation to Analyze (note speaker labels 'Me:' and 'Them:'):**
"${conversation}"
`;
};

// --- MAIN HANDLER FUNCTION ---
module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }
    const { conversationText, goal, persona, isSubscribed } = request.body;
    if (!conversationText) {
        return response.status(400).json({ error: 'No conversation text provided.' });
    }
    if (conversationText.length > 2000) {
        return response.status(413).json({ error: "Input is too long." });
    }

    const cacheKey = `vibe-cache:${PROMPT_VERSION}:${crypto.createHash('md5').update(conversationText + goal + persona).digest('hex')}`;

    try {
        const cachedResult = await redis.get(cacheKey);
        if (cachedResult) {
            console.log("CACHE HIT");
            return response.status(200).json(cachedResult);
        }
        console.log("CACHE MISS");

        const today = new Date().toISOString().split('T')[0];
        const budgetKey = `daily-spend:${today}`;
        const currentSpend = await redis.get(budgetKey) || 0;

        if (currentSpend >= DAILY_BUDGET_GBP && !isSubscribed) {
            return response.status(429).json({ error: "High demand. Please try again later or upgrade." });
        }

        // ✅ NEW: Generate the full prompt dynamically
        const openAIPrompt = generatePrompt(conversationText, goal, persona);
        const modelToUse = isSubscribed ? "gpt-4o" : "gpt-4o-mini";

        const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelToUse,
                messages: [{ role: "system", content: openAIPrompt }],
                response_format: { type: "json_object" },
                max_tokens: 600, // Increased token limit for more detailed analysis
            }),
        });
        
        if (!openAIResponse.ok) {
            console.error("OpenAI API Error:", await openAIResponse.text());
            throw new Error('OpenAI API returned an error.');
        }

        const data = await openAIResponse.json();
        const analysisContent = JSON.parse(data.choices[0].message.content);

        const tokensUsed = data.usage.total_tokens;
        const callCost = (tokensUsed / 1000) * COST_PER_1K_TOKENS_GBP;
        const currentTotal = await redis.incrbyfloat(budgetKey, callCost);
        
        // Set expiry for budget key to 24 hours to auto-clean
        if (currentTotal === callCost) {
            await redis.expire(budgetKey, 86400);
        }
        
        await redis.set(cacheKey, analysisContent, { ex: 86400 });

        return response.status(200).json(analysisContent);

    } catch (error) {
        console.error("Backend Error:", error);
        return response.status(500).json({ error: "A server error occurred. Please try again." });
    }
};