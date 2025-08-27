import { test, expect } from '../fixtures/campaign-creator.fixture';

test.describe('CTA Button Visibility and Persistence - Comprehensive', () => {
  test('CTA button lifecycle in Image & Text Section', async ({ campaignCreator }) => {
    await campaignCreator.goto();
    
    // Set up campaign
    await campaignCreator.setCampaignName('CTA Lifecycle Test');
    await campaignCreator.addBlock('image-left');
    
    // Add content with CTA
    await campaignCreator.editTextContent({
      headline: 'Test Headline',
      body: 'This is test body content.',
      ctaText: 'Shop Now',
      ctaUrl: 'https://example.com'
    });
    
    // Verify immediate visibility
    await campaignCreator.expectCTAButton('Shop Now', 'https://example.com');
    
    // Save and verify persistence
    await campaignCreator.saveDraft();
    await campaignCreator.expectCTAButton('Shop Now', 'https://example.com');
    
    // Test persistence after reload
    await campaignCreator.reloadPage();
    await campaignCreator.expectCTAButton('Shop Now', 'https://example.com');
    
    // Test CTA update
    await campaignCreator.editTextContent({
      ctaText: 'Buy Now',
      ctaUrl: 'https://shop.example.com'
    });
    
    await campaignCreator.expectCTAButton('Buy Now', 'https://shop.example.com');
    await campaignCreator.expectNoCTAButton('Shop Now');
    
    // Test CTA removal
    await campaignCreator.editTextContent({
      ctaText: '',
      ctaUrl: ''
    });
    
    await campaignCreator.expectNoCTAButton('Buy Now');
  });

  test('CTA button in Image block', async ({ campaignCreator }) => {
    await campaignCreator.goto();
    
    await campaignCreator.setCampaignName('Image CTA Test');
    await campaignCreator.addBlock('image-full');
    
    await campaignCreator.editTextContent({
      ctaText: 'View Gallery',
      ctaUrl: 'https://gallery.example.com'
    });
    
    await campaignCreator.expectCTAButton('View Gallery', 'https://gallery.example.com');
  });

  test('CTA button with text-only (no URL)', async ({ campaignCreator }) => {
    await campaignCreator.goto();
    
    await campaignCreator.setCampaignName('Text-Only CTA Test');
    await campaignCreator.addBlock('image-left');
    
    // Add CTA with text but no URL
    await campaignCreator.editTextContent({
      headline: 'Coming Soon',
      ctaText: 'Notify Me'
      // No ctaUrl provided
    });
    
    // Button should still appear but without link
    await campaignCreator.expectCTAButton('Notify Me');
  });

  test('Multiple blocks with different CTAs', async ({ campaignCreator }) => {
    await campaignCreator.goto();
    
    await campaignCreator.setCampaignName('Multi-CTA Test');
    
    // Add first block
    await campaignCreator.addBlock('image-left');
    await campaignCreator.editTextContent({
      headline: 'First Block',
      ctaText: 'Learn More',
      ctaUrl: 'https://learn.example.com'
    });
    
    // Add second block
    await campaignCreator.addBlock('image-right');
    await campaignCreator.editTextContent({
      headline: 'Second Block',
      ctaText: 'Shop Now',
      ctaUrl: 'https://shop.example.com'
    });
    
    // Both CTAs should be visible
    await campaignCreator.expectCTAButton('Learn More', 'https://learn.example.com');
    await campaignCreator.expectCTAButton('Shop Now', 'https://shop.example.com');
    
    // Save and verify persistence of both
    await campaignCreator.saveDraft();
    await campaignCreator.expectCTAButton('Learn More', 'https://learn.example.com');
    await campaignCreator.expectCTAButton('Shop Now', 'https://shop.example.com');
  });
});