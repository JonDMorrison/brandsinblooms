import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Plus, Search, RefreshCw } from 'lucide-react';
import { useCRMPersonas } from '@/hooks/useCRMPersonas';
import { PersonaCard } from '@/components/crm/personas/PersonaCard';
import { CustomPersonaModal } from '@/components/crm/personas/CustomPersonaModal';
import { PersonaOverviewCard } from '@/components/crm/personas/PersonaOverviewCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePersonaCustomerCounts } from '@/hooks/usePersonaCustomerCounts';

// Predefined personas data for garden center customers
const predefinedPersonas = [
  {
    id: 'plant-killer-pam',
    name: 'Plant-Killer Pam',
    description: 'Customers who struggle with keeping plants alive and need low-maintenance options',
    icon: 'leaf' as const,
  },
  {
    id: 'pet-friendly-hannah',
    name: 'Pet-Friendly Hannah',
    description: 'Pet owners looking for safe, non-toxic plants and garden solutions',
    icon: 'heart' as const,
  },
  {
    id: 'vegetable-garden-veronica',
    name: 'Vegetable Garden Veronica',
    description: 'Customers focused on growing their own food and organic gardening',
    icon: 'apple' as const,
  },
  {
    id: 'sustainable-susie',
    name: 'Sustainable Susie',
    description: 'Environmentally conscious gardeners seeking eco-friendly solutions',
    icon: 'recycle' as const,
  },
  {
    id: 'patio-gardener-gail',
    name: 'Patio Gardener Gail',
    description: 'Urban gardeners with limited space focusing on container gardening',
    icon: 'home' as const,
  },
  {
    id: 'pollinator-paula',
    name: 'Pollinator Paula',
    description: 'Customers interested in attracting bees, butterflies, and beneficial insects',
    icon: 'flower' as const,
  },
  {
    id: 'curb-appeal-ashley',
    name: 'Curb Appeal Ashley',
    description: 'Homeowners focused on front yard landscaping and property aesthetics',
    icon: 'eye' as const,
  },
  {
    id: 'diy-dana',
    name: 'DIY Dana',
    description: 'Hands-on gardeners who love projects and building garden features',
    icon: 'hammer' as const,
  },
  {
    id: 'wellness-whitney',
    name: 'Wellness Whitney',
    description: 'Customers interested in therapeutic gardening and mental health benefits',
    icon: 'sun' as const,
  },
];

export const CRMPersonasPage: React.FC = () => {
  const { personas, loading, searchTerm, setSearchTerm, fetchPersonas, createPersona, deletePersona } = useCRMPersonas();
  const { counts: personaCounts, loading: countsLoading } = usePersonaCustomerCounts();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const isMobile = useIsMobile();

  const handleCreatePersona = () => {
    setShowCustomBuilder(true);
  };

  const handleSaveCustomPersona = async (personaData: { name: string; description?: string }): Promise<boolean> => {
    const success = await createPersona(personaData);
    if (success) {
      setShowCustomBuilder(false);
    }
    return success;
  };

  const handleCreateCampaign = (personaId: string) => {
    // Future: Navigate to campaign creation with pre-selected persona
    console.log('Create campaign for persona:', personaId);
  };

  const handleViewPersonaDetails = (personaId: string) => {
    console.log('View persona details:', personaId);
  };

  // Filter predefined personas based on search term
  const filteredPredefinedPersonas = predefinedPersonas.filter(persona =>
    persona.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    persona.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`${isMobile ? 'mobile-section' : 'p-6'} mobile-space-normal mobile-container`}>
      {/* Header */}
      <div className={`${isMobile ? 'mobile-space-tight' : 'flex justify-between items-center'} mb-6`}>
        <h1 className={`${isMobile ? 'mobile-text-hero' : 'text-3xl'} font-bold mb-4 md:mb-0`}>
          Customer Personas
        </h1>
        <div className={`flex ${isMobile ? 'flex-col gap-2' : 'gap-2'}`}>
          <Button 
            variant="outline" 
            onClick={fetchPersonas} 
            disabled={loading}
            className={`${isMobile ? 'mobile-btn-secondary mobile-touch-feedback w-full' : ''} mobile-focus-ring`}
            size={isMobile ? "default" : "sm"}
          >
            <RefreshCw className={`${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'} mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <Button 
            onClick={handleCreatePersona}
            className={`${isMobile ? 'mobile-btn-primary mobile-touch-feedback w-full' : ''} mobile-focus-ring`}
            size={isMobile ? "default" : "sm"}
          >
            <Plus className={`${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'} mr-2`} />
            Create Persona
          </Button>
        </div>
      </div>

      <div className={isMobile ? 'mobile-space-normal' : 'space-y-6'}>
        {/* Search */}
        <Card className="mobile-card-elevated">
          <CardContent className={isMobile ? 'p-4' : 'pt-6'}>
            <div className="relative">
              <Search className={`absolute left-3 top-3 ${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'} text-muted-foreground`} />
              <Input
                placeholder="Search all personas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${isMobile ? 'mobile-touch-target' : ''} mobile-focus-ring`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Predefined Personas */}
        {filteredPredefinedPersonas.length > 0 && (
          <Card className="mobile-card-elevated">
            <CardHeader className={isMobile ? 'p-4 pb-2' : ''}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'mobile-text-heading' : ''}`}>
                <Target className={`${isMobile ? 'mobile-icon-md' : 'h-5 w-5'}`} />
                System Personas
              </CardTitle>
            </CardHeader>
            <CardContent className={isMobile ? 'p-4 pt-2' : ''}>
              <div className={`${isMobile ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}`}>
                {filteredPredefinedPersonas.map((persona) => (
                  <PersonaOverviewCard
                    key={persona.id}
                    name={persona.name}
                    description={persona.description}
                    customerCount={personaCounts[persona.name] || 0}
                    icon={persona.icon}
                    isSystem={true}
                    onCreateCampaign={() => handleCreateCampaign(persona.id)}
                    onViewDetails={() => handleViewPersonaDetails(persona.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Custom Personas */}
        <Card className="mobile-card-elevated">
          <CardHeader className={isMobile ? 'p-4 pb-2' : ''}>
            <CardTitle className={`flex items-center gap-2 ${isMobile ? 'mobile-text-heading' : ''}`}>
              <Target className={`${isMobile ? 'mobile-icon-md' : 'h-5 w-5'}`} />
              Custom Personas
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? 'p-4 pt-2' : ''}>
            {loading ? (
              <div className="text-center py-8">
                <div className={`animate-spin rounded-full ${isMobile ? 'mobile-icon-lg' : 'h-8 w-8'} border-b-2 border-primary mx-auto`}></div>
                <p className={`${isMobile ? 'mobile-text-body' : 'text-muted-foreground'} mt-2`}>
                  Loading custom personas...
                </p>
              </div>
            ) : personas.length === 0 ? (
              <div className="text-center py-8">
                <Target className={`${isMobile ? 'mobile-icon-xl' : 'h-12 w-12'} text-muted-foreground mx-auto mb-4`} />
                <h3 className={`${isMobile ? 'mobile-text-subheading' : 'text-lg'} font-semibold mb-2`}>
                  No custom personas found
                </h3>
                <p className={`${isMobile ? 'mobile-text-body' : 'text-muted-foreground'} mb-4 mobile-text-balance`}>
                  {searchTerm ? 'No custom personas match your search.' : 'Create your first custom persona to start personalizing customer experiences.'}
                </p>
                {!searchTerm && (
                  <Button 
                    onClick={handleCreatePersona}
                    className={`${isMobile ? 'mobile-btn-cta mobile-touch-feedback' : ''} mobile-focus-ring`}
                  >
                    <Plus className={`${isMobile ? 'mobile-icon-sm' : 'h-4 w-4'} mr-2`} />
                    Create Your First Custom Persona
                  </Button>
                )}
              </div>
            ) : (
              <div className={`${isMobile ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}`}>
                {personas.map((persona) => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    onDelete={deletePersona}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CustomPersonaModal
        open={showCustomBuilder}
        onSave={handleSaveCustomPersona}
        onCancel={() => setShowCustomBuilder(false)}
      />
    </div>
  );
};