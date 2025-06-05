
interface ThemeDescriptionGeneratorProps {
  theme: string;
  onDescriptionGenerated: (description: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

export const generateThemeDescription = async (
  theme: string,
  onDescriptionGenerated: (description: string) => void,
  onLoadingChange: (isLoading: boolean) => void
) => {
  if (!theme.trim()) return;
  
  onLoadingChange(true);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a marketing content strategist for a garden center. Write exactly two sentences that describe the type of content that should be created for a specific weekly theme. These sentences will guide the creation of newsletters, social media posts, emails, and video scripts for that week.'
          },
          {
            role: 'user',
            content: `Generate a two-sentence description for this weekly theme: "${theme}". Focus on what type of content should be created and what the main focus should be for that week.`
          }
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate description');
    }

    const data = await response.json();
    const description = data.choices[0].message.content.trim();
    onDescriptionGenerated(description);
  } catch (error) {
    console.error('Error generating description:', error);
    // Better fallback description based on the theme
    const fallbackDescription = `This week's content will showcase practical techniques and expert guidance for ${theme.toLowerCase()}, helping customers achieve successful results in their gardens. All materials will emphasize step-by-step instructions, seasonal timing, and the quality products available at our garden center to support their ${theme.toLowerCase()} goals.`;
    onDescriptionGenerated(fallbackDescription);
  } finally {
    onLoadingChange(false);
  }
};
