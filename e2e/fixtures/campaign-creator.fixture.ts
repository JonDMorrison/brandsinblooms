import { test as base, expect, Page } from '@playwright/test';

export interface CampaignCreatorFixture {
  campaignCreator: CampaignCreatorPage;
}

export class CampaignCreatorPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/crm/campaigns/new');
    await this.page.waitForSelector('#campaign-name', { timeout: 10000 });
  }

  async setCampaignName(name: string) {
    await this.page.fill('#campaign-name', name);
  }

  async addBlock(layoutType: string) {
    await this.page.click('button:has-text("Add Block")');
    await this.page.click(`[data-testid="layout-${layoutType}"]`);
    await this.page.waitForSelector('.group', { timeout: 5000 });
  }

  async editTextContent(options: {
    headline?: string;
    body?: string;
    ctaText?: string;
    ctaUrl?: string;
  }) {
    // Click to edit text
    await this.page.click('[data-testid="edit-text-button"]');
    
    // Fill fields if provided
    if (options.headline) {
      await this.page.fill('input[placeholder*="headline"]', options.headline);
    }
    
    if (options.body) {
      // Try different selectors for body content
      const bodySelectors = [
        'textarea[placeholder*="body"]',
        '[contenteditable][placeholder*="body"]',
        'textarea[placeholder*="content"]',
        '[data-testid="body-editor"]'
      ];
      
      for (const selector of bodySelectors) {
        if (await this.page.locator(selector).count() > 0) {
          await this.page.fill(selector, options.body);
          break;
        }
      }
    }
    
    if (options.ctaText) {
      await this.page.fill('input[placeholder*="button text"]', options.ctaText);
    }
    
    if (options.ctaUrl) {
      await this.page.fill('input[placeholder*="button url"]', options.ctaUrl);
    }
    
    // Save
    await this.page.click('button:has-text("Save")');
    await this.page.waitForTimeout(1000);
  }

  async expectCTAButton(text: string, url?: string) {
    const button = this.page.locator(`a:has-text("${text}"), button:has-text("${text}")`);
    await expect(button).toBeVisible();
    
    if (url) {
      const link = this.page.locator(`a:has-text("${text}")`);
      if (await link.count() > 0) {
        await expect(link).toHaveAttribute('href', url);
      }
    }
  }

  async expectNoCTAButton(text: string) {
    await expect(this.page.locator(`text=${text}`)).not.toBeVisible();
  }

  async saveDraft() {
    await this.page.click('button:has-text("Save as Draft")');
    await this.page.waitForSelector(':has-text("Campaign saved")', { timeout: 5000 });
  }

  async reloadPage() {
    await this.page.reload();
    await this.page.waitForSelector('[data-testid="content-block"]');
  }
}

export const test = base.extend<CampaignCreatorFixture>({
  campaignCreator: async ({ page }, use) => {
    const campaignCreator = new CampaignCreatorPage(page);
    await use(campaignCreator);
  },
});

export { expect };