import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SmartSegmentBuilder } from '@/components/crm/segments/SmartSegmentBuilder';

const SegmentBuilderPage = () => {
  const navigate = useNavigate();

  const handleSave = (segment: any) => {
    // Navigate back to segments page after successful save
    navigate('/crm/segments');
  };

  return (
    <div className="container max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/crm/segments')}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Smart Segment</h1>
          <p className="text-muted-foreground">
            Build powerful customer segments with intelligent rules
          </p>
        </div>
      </div>

      {/* Segment Builder */}
      <SmartSegmentBuilder onSave={handleSave} />
    </div>
  );
};

export default SegmentBuilderPage;