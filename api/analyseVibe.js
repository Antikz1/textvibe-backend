export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { conversationText } = request.body;
  if (!conversationText) {
    return response.status(400).json({ error: 'No conversation text provided.' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const openAIPrompt = `You are an AI dating coach. Analyze the following dating conversation for a user aged 16-30. Provide a JSON response with the following keys: 'toneLabel', 'confidenceScore' (1-10), 'interestScore' (1-10), 'keyInsight', 'rephrasedResponse', and 'emojiSummary'. The keyInsight should be a short, catchy tagline. The rephrasedResponse should be a suggested reply. Conversation: "${conversationText}"`;

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