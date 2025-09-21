import { Redis } from '@upstash/redis'
import crypto from "crypto";

// --- CONFIGURATION & VERSIONING ---
// Incrementing this will invalidate all old cache entries, ensuring users get the new, extraordinary results.
const PROMPT_VERSION = "2.0-legendary";
const DAILY_BUDGET_GBP = 50.00;
const COST_PER_1K_TOKENS_GBP = 0.0006;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// --- DYNAMIC PROMPT GENERATION (THE "SECRET SAUCE") ---
const generatePrompt = (conversation, goal, persona) => {
    let personaInstruction = "";
    switch (persona) {
        case "Direct 🤔":
            personaInstruction = "Your tone is The Strategist: direct, logical, and insightful. Your advice is framed around achieving the user's goal with maximum efficiency and clarity. You are confident and analytical.";
            break;
        case "Wingman 🔥":
            personaInstruction = "Your tone is The Wingman: fun, encouraging, and high-energy. Use modern slang and be relentlessly supportive. Your goal is to boost the user's confidence and make the interaction fun.";
            break;
        case "Joker 😂":
            personaInstruction = "Your tone is The Comedian: witty, clever, and sarcastic. You find the humour in the situation and create replies that are genuinely funny while still being strategically sound.";
            break;
        case "Rebel 😈":
            personaInstruction = "Your tone is The Rebel: brutally honest and unfiltered, challenging conventional dating advice. You are not just being rude; you are providing high-risk, high-reward strategies that break patterns. You MUST include a 'consequence' field in your reply objects, warning of the potential negative outcome.";
            break;
        default:
            personaInstruction = "Your tone is that of a helpful, neutral dating coach.";
    }

    // This is the legendary prompt. It instructs the AI to perform a multi-layered, strategic analysis.
    return `
You are "VibeCheck," a world-class communication strategist and dating coach. Your analysis is legendary, providing users with an almost unfair advantage. You must use British English spelling and colloquialisms.

**Persona Directive:** ${personaInstruction}

**User's Goal:** The user's primary objective is to: "${goal}". Your entire analysis and all suggestions must be laser-focused on achieving this goal.

**Extraordinary Analysis Protocol (5 Steps):**
1.  **Strategic Analysis & Vibe Radar:** Provide a deep, insightful paragraph explaining the conversation's dynamic. Go beyond the obvious. Analyze the subtext, emoji usage, question-to-statement ratio, and implied response times. Frame your analysis using psychological principles like 'Push/Pull', 'Scarcity', or 'Demonstrated High Value'.
2.  **Power Dynamic:** Explicitly state who holds the power in the conversation (e.g., "User is pursuing", "They are pursuing", "Balanced").
3.  **Scoring:** Provide a 'confidenceScore' and an 'interestScore' from the other person's perspective (scale of 1-10).
4.  **Strategic Replies:** Generate an array of **exactly THREE** distinct suggested replies. Each reply object must be a complete strategic package with the following keys:
    * **'title':** A catchy name for the strategy (e.g., "The Playful Challenge").
    * **'text':** The suggested reply message.
    * **'mindset':** The crucial psychological mindset the user should adopt when sending the message (e.g., "Confident & Unattached," "Playfully Curious"). This is critical.
    * **'reason':** A brief explanation of *why* this strategy is effective for the user's goal.
    * **'riskLevel':** The potential risk of this reply (Low, Medium, or High).
    * **'potentialOutcome':** The likely positive result if the strategy works.
    * **'consequence':** (Only for The Rebel persona) A warning of the potential negative outcome.

**CRITICAL Output Format:**
You must respond ONLY with a single, minified JSON object. Do not include any introductory text, markdown, or explanations. The JSON structure must exactly match this example:
{"strategicAnalysis":"","powerDynamic":"","confidenceScore":0,"interestScore":0,"suggestedReplies":[{"title":"","text":"","mindset":"","reason":"","riskLevel":"","potentialOutcome":""}]}

**Conversation to Analyze (Pay close attention to 'Me:' and 'Them:' labels):**
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

        const openAIPrompt = generatePrompt(conversationText, goal, persona);
        const modelToUse = isSubscribed ? "gpt-4o" : "gpt-4o-mini";
        const maxTokens = isSubscribed ? 800 : 400; // Give premium users a more detailed response

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
                max_tokens: maxTokens,
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

