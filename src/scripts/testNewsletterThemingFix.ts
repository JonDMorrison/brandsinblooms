import { supabase } from "@/integrations/supabase/client";
import { regenerateWorldVegetarianNewsletter } from "./regenerateWorldVegetarianNewsletter";

interface TestResult {
  theme: string;
  success: boolean;
  issues: string[];
  contentPreview: string;
  hasThemeSpecificContent: boolean;
  hasGenericContent: boolean;
}

export async function testNewsletterThemingFix(): Promise<{
  success: boolean;
  results: TestResult[];
  summary: string;
}> {
  console.log('🧪 Starting Newsletter Theming Fix Test...');
  
  const testThemes = [
    'World Vegetarian Day',
    'National Seed Harvest Week', 
    'Fall Transition Planning'
  ];
  
  const results: TestResult[] = [];
  
  // Test 1: Use existing regeneration utility
  console.log('📋 Test 1: Testing existing World Vegetarian Day regeneration...');
  try {
    const regenResult = await regenerateWorldVegetarianNewsletter();
    
    results.push({
      theme: 'World Vegetarian Day (Regenerated)',
      success: regenResult.success && regenResult.hasVegetableContent && !regenResult.hasUnwantedContent,
      issues: regenResult.hasUnwantedContent ? ['Contains unwanted seasonal content'] : [],
      contentPreview: regenResult.content?.substring(0, 200) || 'No content',
      hasThemeSpecificContent: regenResult.hasVegetableContent || false,
      hasGenericContent: regenResult.hasUnwantedContent || false
    });
    
    console.log('✅ Regeneration test completed');
  } catch (error) {
    console.error('❌ Regeneration test failed:', error);
    results.push({
      theme: 'World Vegetarian Day (Regenerated)',
      success: false,
      issues: [`Regeneration failed: ${error.message}`],
      contentPreview: 'Test failed',
      hasThemeSpecificContent: false,
      hasGenericContent: false
    });
  }
  
  // Test 2: Generate fresh newsletter content for each theme
  for (const theme of testThemes) {
    console.log(`📋 Test 2: Testing fresh generation for "${theme}"...`);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-structured-newsletter', {
        body: {
          business_name: 'Test Garden Center',
          theme: theme,
          week_focus: `Generate themed newsletter content for ${theme}`,
          userId: (await supabase.auth.getUser()).data.user?.id,
          promo_items: [],
          tone_note: 'Test generation for theme alignment',
          is_holiday: true,
          holiday_context: `This is a test for ${theme} themed content`
        }
      });
      
      if (error) {
        throw error;
      }
      
      const content = data?.yamlContent || '';
      const hasThemeKeywords = validateThemeAlignment(content, theme);
      const hasGenericContent = detectGenericContent(content);
      
      results.push({
        theme: theme,
        success: hasThemeKeywords && !hasGenericContent,
        issues: [
          ...(!hasThemeKeywords ? ['Missing theme-specific content'] : []),
          ...(hasGenericContent ? ['Contains generic seasonal content'] : [])
        ],
        contentPreview: content.substring(0, 200),
        hasThemeSpecificContent: hasThemeKeywords,
        hasGenericContent: hasGenericContent
      });
      
      console.log(`✅ Fresh generation test for "${theme}" completed`);
      
    } catch (error) {
      console.error(`❌ Fresh generation test for "${theme}" failed:`, error);
      results.push({
        theme: theme,
        success: false,
        issues: [`Generation failed: ${error.message}`],
        contentPreview: 'Test failed',
        hasThemeSpecificContent: false,
        hasGenericContent: false
      });
    }
  }
  
  // Generate summary
  const successfulTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  const overallSuccess = successfulTests === totalTests;
  
  const summary = `Newsletter Theming Fix Test Results:
✅ Successful: ${successfulTests}/${totalTests} tests
${overallSuccess ? '🎉 All tests passed! Newsletter theming fix is working correctly.' : '⚠️ Some tests failed. Newsletter theming fix needs attention.'}

Detailed Results:
${results.map(r => `
• ${r.theme}: ${r.success ? '✅ PASS' : '❌ FAIL'}
  ${r.issues.length > 0 ? `Issues: ${r.issues.join(', ')}` : 'No issues detected'}
  Preview: ${r.contentPreview}...
`).join('')}`;
  
  console.log(summary);
  
  return {
    success: overallSuccess,
    results,
    summary
  };
}

function validateThemeAlignment(content: string, theme: string): boolean {
  const lowerContent = content.toLowerCase();
  const lowerTheme = theme.toLowerCase();
  
  // Define theme-specific keywords
  const themeKeywords: { [key: string]: string[] } = {
    'world vegetarian day': ['vegetarian', 'vegetable', 'plant-based', 'homegrown', 'harvest', 'fresh produce'],
    'national seed harvest week': ['seed', 'harvest', 'saving', 'collection', 'heirloom', 'planting'],
    'fall transition planning': ['fall', 'autumn', 'transition', 'preparation', 'seasonal', 'winter prep']
  };
  
  const keywords = themeKeywords[lowerTheme] || [];
  const keywordMatches = keywords.filter(keyword => lowerContent.includes(keyword));
  
  // Should have at least 2 theme-specific keywords
  return keywordMatches.length >= 2;
}

function detectGenericContent(content: string): boolean {
  const genericPhrases = [
    'beat the heat',
    'summer care',
    'sos: save your plants',
    'water your garden',
    'protect from sun',
    'summer survival guide'
  ];
  
  const lowerContent = content.toLowerCase();
  return genericPhrases.some(phrase => lowerContent.includes(phrase));
}