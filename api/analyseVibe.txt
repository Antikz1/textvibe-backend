export default async function handler(request, response) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { conversationText } = request.body;

  // Abort if no text is provided
  if (!conversationText) {
    return response.status(400).json({ error: 'No conversation text provided.' });
  }

  // Securely get the API key from environment variables
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
        model: "gpt-4",
        messages: [{ role: "system", content: openAIPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!openAIResponse.ok) {
      throw new Error(`OpenAI API error: ${openAIResponse.statusText}`);
    }
    
    const data = await openAIResponse.json();
    // The actual analysis is nested inside the response content, which is a JSON string.
    const analysisContent = JSON.parse(data.choices[0].message.content);

    // Send the clean analysis back to your app
    response.status(200).json(analysisContent);

  } catch (error) {
    console.error(error);
    response.status(500).json({ error: 'Failed to fetch analysis from OpenAI.' });
  }
}