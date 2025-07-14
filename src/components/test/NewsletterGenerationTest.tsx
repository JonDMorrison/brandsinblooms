
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { generateStructuredNewsletter } from '@/components/homepage/StructuredNewsletterService';
import { MagazineNewsletterDisplay } from '@/components/content-sidebar/MagazineNewsletterDisplay';
import { parseNewsletterYAML } from '@/utils/newsletterUtils';
import { useAuth } from '@/contexts/AuthContext';
// Removed sonner import - using global toast replacement

export const NewsletterGenerationTest = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [parsedNewsletter, setParsedNewsletter] = useState<any>(null);

  const testNewsletterGeneration = async () => {
    if (!user) {
      toast.error('Please log in to test newsletter generation');
      return;
    }

    setLoading(true);
    try {
      console.log('🧪 Testing newsletter generation...');
      
      const content = await generateStructuredNewsletter(
        'test-campaign-id',
        'Winter Garden Preparation',
        1,
        user.id,
        'Preparing your garden for the winter season with proper care and protection techniques'
      );

      console.log('🧪 Generated content:', content);
      setGeneratedContent(content);

      // Try to parse the content
      const parsed = parseNewsletterYAML(content);
      console.log('🧪 Parsed newsletter:', parsed);
      setParsedNewsletter(parsed);

      if (parsed && parsed.blocks && parsed.blocks.length === 4) {
        toast.success('✅ Newsletter generated successfully with 4 sections!');
      } else {
        toast.warning('⚠️ Newsletter generated but may not have proper 4-section structure');
      }
    } catch (error) {
      console.error('❌ Newsletter generation test failed:', error);
      toast.error('Failed to generate newsletter: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Newsletter Generation Test</h2>
      
      <div className="mb-6">
        <Button 
          onClick={testNewsletterGeneration}
          disabled={loading || !user}
          className="mr-4"
        >
          {loading ? 'Generating...' : 'Test Newsletter Generation'}
        </Button>
        
        {!user && (
          <p className="text-sm text-gray-500 mt-2">Please log in to test newsletter generation</p>
        )}
      </div>

      {generatedContent && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Generation Results:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-gray-50 rounded">
                <strong>Parsed Successfully:</strong> {parsedNewsletter ? '✅ Yes' : '❌ No'}
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <strong>Sections Count:</strong> {parsedNewsletter?.blocks?.length || 0}
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <strong>Has YAML Structure:</strong> {generatedContent.includes('newsletter_md:') ? '✅ Yes' : '❌ No'}
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <strong>Content Length:</strong> {generatedContent.length} chars
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Raw Generated Content:</h3>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto whitespace-pre-wrap">
              {generatedContent}
            </pre>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Rendered Newsletter:</h3>
            <div className="border border-gray-200 rounded p-4">
              <MagazineNewsletterDisplay content={generatedContent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
