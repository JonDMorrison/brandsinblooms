import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});

describe('Automation Dropdown Test', () => {
  it('should test automation dropdown functionality', () => {
    // Visit the CRM automation builder page
    cy.visit('/crm/automations/new');
    
    // Find and click the trigger type dropdown
    cy.get('button').contains('Select trigger type').click();
    
    // Assert that the dropdown listbox is visible
    cy.get('[role="listbox"]').should('be.visible');
    
    // Check that body overflow is hidden (scroll locked)
    cy.document().then((doc) => {
      expect(doc.body.style.overflow).to.eq('hidden');
    });
    
    // Select a trigger option
    cy.get('[role="listbox"]').contains('Customer joins Loyalty Program').click();
    
    // Verify dropdown closes and scroll lock is released
    cy.get('[role="listbox"]').should('not.exist');
    cy.document().then((doc) => {
      expect(doc.body.style.overflow).to.not.eq('hidden');
    });
    
    // Verify template selector appears
    cy.contains('Choose a Template').should('be.visible');
  });
});