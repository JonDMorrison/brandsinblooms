// Test utilities for newsletter-to-CRM sync debugging
import { sendToCRM } from './sendToCRM';
import { enhancedNewsletterToCRM } from './enhancedNewsletterToCrmConverter';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  stage: string;
  success: boolean;
  data?: any;
  error?: any;
  logs: string[];
}

export const testNewsletterCRMSync = async (contentTaskId: string): Promise<TestResult[]> => {
  const results: TestResult[] = [];
  const logs: string[] = [];

  // Stage 1: Test content task fetch
  try {
    logs.push(`🔍 Testing content task fetch for ID: ${contentTaskId}`);
    
    const { data: contentTask, error } = await supabase
      .from('content_tasks')
      .select(`
        *,
        campaigns (
          id,
          title,
          theme,
          week_number,
          source,
          description
        ),
        holidays (
          id,
          holiday_name,
          category,
          garden_relevance
        )
      `)
      .eq('id', contentTaskId)
      .single();

    if (error) throw error;
    
    results.push({
      stage: 'Content Task Fetch',
      success: true,
      data: {
        hasContent: !!contentTask.ai_output,
        contentLength: contentTask.ai_output?.length || 0,
        hasCampaign: !!contentTask.campaigns,
        campaignTitle: contentTask.campaigns?.title,
        hasHoliday: !!contentTask.holidays,
        postType: contentTask.post_type
      },
      logs: [...logs]
    });
    
    logs.push(`✅ Content task fetched successfully`);
    logs.push(`📊 Content length: ${contentTask.ai_output?.length || 0} characters`);
    logs.push(`🏷️ Campaign: ${contentTask.campaigns?.title || 'None'}`);
    
  } catch (error) {
    results.push({
      stage: 'Content Task Fetch',
      success: false,
      error: error,
      logs: [...logs]
    });
    logs.push(`❌ Content task fetch failed: ${error}`);
  }

  // Stage 2: Test enhanced newsletter conversion
  try {
    logs.push(`🔄 Testing enhanced newsletter conversion...`);
    
    const mockUrlParams = new URLSearchParams({
      fromContentTaskId: contentTaskId,
      source: 'newsletter_content'
    });
    
    const result = await enhancedNewsletterToCRM(contentTaskId, mockUrlParams);
    
    results.push({
      stage: 'Enhanced Newsletter Conversion',
      success: true,
      data: {
        campaignName: result.campaignName,
        subjectLine: result.subjectLine,
        contentBlocksCount: result.contentBlocks.length,
        personaTagsCount: result.personaTags.length,
        segmentSuggestionsCount: result.segmentSuggestions.length,
        themeSource: result.themeSource,
        hasOriginalContent: !!result.originalContent
      },
      logs: [...logs]
    });
    
    logs.push(`✅ Enhanced conversion completed`);
    logs.push(`📝 Generated ${result.contentBlocks.length} content blocks`);
    logs.push(`🏷️ Found ${result.personaTags.length} persona tags`);
    logs.push(`📊 Suggested ${result.segmentSuggestions.length} segments`);
    
  } catch (error) {
    results.push({
      stage: 'Enhanced Newsletter Conversion',
      success: false,
      error: error,
      logs: [...logs]
    });
    logs.push(`❌ Enhanced conversion failed: ${error}`);
  }

  // Stage 3: Test sendToCRM URL generation
  try {
    logs.push(`🔗 Testing sendToCRM URL generation...`);
    
    // Mock the window.location.href assignment to capture the URL
    const originalLocation = window.location.href;
    let capturedUrl = '';
    
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        href: ''
      },
      writable: true
    });
    
    // Override location setter to capture URL
    Object.defineProperty(window.location, 'href', {
      set: function(value) {
        capturedUrl = value;
      },
      get: function() {
        return capturedUrl;
      }
    });
    
    // Test sendToCRM (this will try to navigate, but we'll capture the URL)
    await sendToCRM(contentTaskId);
    
    // Restore original location
    window.location.href = originalLocation;
    
    results.push({
      stage: 'SendToCRM URL Generation',
      success: true,
      data: {
        generatedUrl: capturedUrl,
        urlLength: capturedUrl.length,
        hasFromContentTaskId: capturedUrl.includes('fromContentTaskId'),
        hasSource: capturedUrl.includes('source=newsletter_content'),
        hasTitle: capturedUrl.includes('title='),
        hasPersonaTags: capturedUrl.includes('personaTags='),
        hasSegmentSuggestions: capturedUrl.includes('segmentSuggestions=')
      },
      logs: [...logs]
    });
    
    logs.push(`✅ URL generation completed`);
    logs.push(`🔗 Generated URL: ${capturedUrl.substring(0, 100)}...`);
    
  } catch (error) {
    results.push({
      stage: 'SendToCRM URL Generation',
      success: false,
      error: error,
      logs: [...logs]
    });
    logs.push(`❌ URL generation failed: ${error}`);
  }

  return results;
};

// Debug helper to log the test results
export const logTestResults = (results: TestResult[]) => {
  console.log('🧪 Newsletter-CRM Sync Test Results:');
  console.log('====================================');
  
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${index + 1}. ${icon} ${result.stage}`);
    
    if (result.success && result.data) {
      console.log('   Data:', result.data);
    }
    
    if (!result.success && result.error) {
      console.log('   Error:', result.error);
    }
    
    console.log('   Logs:');
    result.logs.forEach(log => console.log(`     ${log}`));
    console.log('');
  });
  
  const passedTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  
  console.log(`📊 Test Summary: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Newsletter-CRM sync is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Check the errors above for debugging.');
  }
};

// Usage example:
// testNewsletterCRMSync('your-content-task-id').then(logTestResults);