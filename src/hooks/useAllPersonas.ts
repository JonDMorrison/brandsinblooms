import { useMemo } from 'react';
import { useCRMPersonas } from './useCRMPersonas';

// Predefined personas that match those in CRMPersonasPage
const predefinedPersonas = [
  {
    id: 'plant-killer-pam',
    persona_name: 'Plant-Killer Pam',
    persona_description: 'Customers who struggle with keeping plants alive and need low-maintenance options',
    is_custom: false,
  },
  {
    id: 'pet-friendly-hannah',
    persona_name: 'Pet-Friendly Hannah',
    persona_description: 'Pet owners looking for safe, non-toxic plants and garden solutions',
    is_custom: false,
  },
  {
    id: 'vegetable-garden-veronica',
    persona_name: 'Vegetable Garden Veronica',
    persona_description: 'Customers focused on growing their own food and organic gardening',
    is_custom: false,
  },
  {
    id: 'sustainable-susie',
    persona_name: 'Sustainable Susie',
    persona_description: 'Environmentally conscious gardeners seeking eco-friendly solutions',
    is_custom: false,
  },
  {
    id: 'patio-gardener-gail',
    persona_name: 'Patio Gardener Gail',
    persona_description: 'Urban gardeners with limited space focusing on container gardening',
    is_custom: false,
  },
  {
    id: 'pollinator-paula',
    persona_name: 'Pollinator Paula',
    persona_description: 'Customers interested in attracting bees, butterflies, and beneficial insects',
    is_custom: false,
  },
  {
    id: 'curb-appeal-ashley',
    persona_name: 'Curb Appeal Ashley',
    persona_description: 'Homeowners focused on front yard landscaping and property aesthetics',
    is_custom: false,
  },
  {
    id: 'diy-dana',
    persona_name: 'DIY Dana',
    persona_description: 'Hands-on gardeners who love projects and building garden features',
    is_custom: false,
  },
  {
    id: 'wellness-whitney',
    persona_name: 'Wellness Whitney',
    persona_description: 'Customers interested in therapeutic gardening and mental health',
    is_custom: false,
  },
];

interface Persona {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
}

export const useAllPersonas = () => {
  const { personas: customPersonas, loading } = useCRMPersonas();

  const allPersonas = useMemo(() => {
    const combined: Persona[] = [
      ...predefinedPersonas,
      ...customPersonas
    ];
    return combined;
  }, [customPersonas]);

  return {
    personas: allPersonas,
    loading,
    predefinedPersonas,
    customPersonas
  };
};