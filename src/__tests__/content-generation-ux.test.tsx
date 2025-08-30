import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManualContentGenerator } from '@/components/content/ManualContentGenerator';
import { ContentGenerationLoadingModal } from '@/components/content/ContentGenerationLoadingModal';

// Mock the dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } })
}));

vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({ tenant: { id: 'test-tenant' } })
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}));

vi.mock('@/components/homepage/ContentGenerationServices', () => ({
  generateCampaignContent: vi.fn().mockResolvedValue({
    success: true,
    tasks: [
      { id: '1', post_type: 'facebook', ai_output: 'Test content' },
      { id: '2', post_type: 'instagram', ai_output: 'Test content 2' }
    ]
  })
}));

describe('Content Generation UX', () => {
  const mockCampaign = {
    id: 'test-campaign',
    title: 'Test Campaign',
    theme: 'Spring Garden',
    description: 'Spring campaign for garden center',
    week_number: 10
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ManualContentGenerator with Modal', () => {
    it('should show loading modal during generation and content modal after', async () => {
      const onContentGenerated = vi.fn();
      
      render(
        <ManualContentGenerator 
          campaign={mockCampaign}
          onContentGenerated={onContentGenerated}
          showAsModal={true}
        />
      );

      // Click generate button
      const generateButton = screen.getByRole('button', { name: /generate content manually/i });
      fireEvent.click(generateButton);

      // Should show loading modal immediately
      await waitFor(() => {
        expect(screen.getByText('Generating Your Content')).toBeInTheDocument();
        expect(screen.getByText('Creating personalized content for')).toBeInTheDocument();
        expect(screen.getByText('Test Campaign')).toBeInTheDocument();
      });

      // Should show progress and steps
      expect(screen.getByText(/% complete/)).toBeInTheDocument();
      expect(screen.getByText('Analyzing your campaign theme')).toBeInTheDocument();

      // Wait for generation to complete and content modal to appear
      await waitFor(() => {
        expect(screen.queryByText('Generating Your Content')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should disable generate button during generation', async () => {
      const onContentGenerated = vi.fn();
      
      render(
        <ManualContentGenerator 
          campaign={mockCampaign}
          onContentGenerated={onContentGenerated}
          showAsModal={true}
        />
      );

      const generateButton = screen.getByRole('button', { name: /generate content manually/i });
      
      // Button should be enabled initially
      expect(generateButton).not.toBeDisabled();

      // Click generate button
      fireEvent.click(generateButton);

      // Button should be disabled during generation
      expect(generateButton).toBeDisabled();
      expect(generateButton).toHaveTextContent('Generating Content...');

      // Wait for generation to complete
      await waitFor(() => {
        expect(generateButton).not.toBeDisabled();
      }, { timeout: 3000 });
    });
  });

  describe('ContentGenerationLoadingModal', () => {
    it('should display campaign title and progress', () => {
      render(
        <ContentGenerationLoadingModal 
          isOpen={true}
          campaignTitle="Spring Garden Campaign"
          progress={45}
        />
      );

      expect(screen.getByText('Generating Your Content')).toBeInTheDocument();
      expect(screen.getByText('Creating personalized content for')).toBeInTheDocument();
      expect(screen.getByText('Spring Garden Campaign')).toBeInTheDocument();
      expect(screen.getByText('45% complete')).toBeInTheDocument();
    });

    it('should show generation steps progressively', async () => {
      render(
        <ContentGenerationLoadingModal 
          isOpen={true}
          campaignTitle="Test Campaign"
        />
      );

      // First step should be visible immediately
      expect(screen.getByText('Analyzing your campaign theme')).toBeInTheDocument();
      
      // Wait for subsequent steps to appear
      await waitFor(() => {
        expect(screen.getByText('Crafting social media posts')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not render when closed', () => {
      render(
        <ContentGenerationLoadingModal 
          isOpen={false}
          campaignTitle="Test Campaign"
        />
      );

      expect(screen.queryByText('Generating Your Content')).not.toBeInTheDocument();
    });
  });
});