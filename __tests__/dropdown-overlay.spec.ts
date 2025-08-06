/// <reference types="cypress" />

describe('Dropdown Overlay System', () => {
  beforeEach(() => {
    cy.visit('/crm/automations/new');
    cy.wait(1000); // Allow page to load
  });

  it('should open "Select Trigger Type" dropdown and manage scroll correctly', () => {
    // Test dropdown opens and is visible
    cy.get('[data-testid="trigger-type-select"]').should('be.visible');
    cy.get('[data-testid="trigger-type-select"]').click();
    
    // Verify dropdown listbox is visible
    cy.get('[role="listbox"]').should('be.visible');
    
    // Verify body scroll is locked when dropdown is open
    cy.document().then((doc) => {
      expect(doc.body.style.overflow).to.eq('hidden');
    });
    
    // Test dropdown selection
    cy.get('[role="option"]').first().click();
    
    // Verify dropdown closes
    cy.get('[role="listbox"]').should('not.exist');
    
    // Verify body scroll is unlocked after dropdown closes
    cy.document().then((doc) => {
      expect(doc.body.style.overflow).to.eq('');
    });
  });

  it('should handle single-option dropdowns with locked pill display', () => {
    // This test assumes Twilio is not set up, showing only base triggers
    cy.get('.locked-pill').should('be.visible');
    cy.get('.locked-pill').should('contain.text', 'More options with SMS setup');
  });

  it('should maintain proper z-index stacking', () => {
    cy.get('[data-testid="trigger-type-select"]').click();
    
    // Verify overlay has correct z-index
    cy.get('#overlay-root').should('have.css', 'z-index', '30');
    
    // Verify dropdown content has higher z-index
    cy.get('[role="listbox"]').should('have.css', 'z-index').and('satisfy', (zIndex) => {
      return parseInt(zIndex) >= 40;
    });
  });

  it('should handle escape key to close dropdown', () => {
    cy.get('[data-testid="trigger-type-select"]').click();
    cy.get('[role="listbox"]').should('be.visible');
    
    // Press escape key
    cy.get('body').type('{esc}');
    
    // Verify dropdown closes
    cy.get('[role="listbox"]').should('not.exist');
    
    // Verify scroll is unlocked
    cy.document().then((doc) => {
      expect(doc.body.style.overflow).to.eq('');
    });
  });

  it('should handle outside click to close dropdown', () => {
    cy.get('[data-testid="trigger-type-select"]').click();
    cy.get('[role="listbox"]').should('be.visible');
    
    // Click outside the dropdown
    cy.get('body').click(0, 0);
    
    // Verify dropdown closes
    cy.get('[role="listbox"]').should('not.exist');
    
    // Verify scroll is unlocked
    cy.document().then((doc) => {
      expect(doc.body.style.overflow).to.eq('');
    });
  });
});