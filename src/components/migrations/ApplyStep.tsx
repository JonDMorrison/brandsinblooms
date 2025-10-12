import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Edit2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

interface ApplyStepProps {
  suggestions: any[];
  onComplete: () => void;
  onBack: () => void;
}

export const ApplyStep = ({ suggestions, onComplete, onBack }: ApplyStepProps) => {
  const { toast } = useToast();
  const [editedSuggestions, setEditedSuggestions] = useState(suggestions);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleApply = async () => {
    const highConfidence = editedSuggestions.filter(s => !s.error && s.confidence >= 0.75);
    
    toast({
      title: 'Applying Mappings',
      description: `Applying ${highConfidence.length} mappings with ≥75% confidence`
    });

    // All suggestions will be applied in the Import step
    onComplete();
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleSave = (index: number, updates: any) => {
    const updated = [...editedSuggestions];
    updated[index] = { ...updated[index], ...updates };
    setEditedSuggestions(updated);
    setEditingIndex(null);
  };

  const handleRemove = (index: number) => {
    const updated = editedSuggestions.filter((_, i) => i !== index);
    setEditedSuggestions(updated);
    toast({
      title: 'Suggestion Removed',
      description: 'Mapping suggestion has been removed'
    });
  };

  const validSuggestions = editedSuggestions.filter(s => !s.error);
  const autoApplyCount = validSuggestions.filter(s => s.confidence >= 0.75).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Review & Apply Mappings</h2>
        <p className="text-muted-foreground">
          Review AI suggestions and edit as needed. Mappings with ≥75% confidence will be auto-applied.
        </p>
      </div>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="font-medium">
              {autoApplyCount} of {validSuggestions.length} mappings will be auto-applied
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {validSuggestions.length - autoApplyCount} require manual review
          </span>
        </div>
      </Card>

      <div className="space-y-3">
        {editedSuggestions.map((suggestion, index) => (
          <Card key={index} className="p-4">
            {editingIndex === index ? (
              <EditSuggestionForm
                suggestion={suggestion}
                onSave={(updates) => handleSave(index, updates)}
                onCancel={() => setEditingIndex(null)}
              />
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{suggestion.artifact_name}</h4>
                      {!suggestion.error && (
                        <>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            suggestion.action === 'create_segment' ? 'bg-blue-100 text-blue-800' :
                            suggestion.action === 'map_to_segment' ? 'bg-green-100 text-green-800' :
                            suggestion.action === 'create_persona' ? 'bg-purple-100 text-purple-800' :
                            suggestion.action === 'map_to_persona' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {suggestion.action.replace(/_/g, ' ')}
                          </span>
                          <span className={`font-semibold ${
                            suggestion.confidence >= 0.75 ? 'text-green-600' :
                            suggestion.confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {Math.round(suggestion.confidence * 100)}%
                          </span>
                        </>
                      )}
                    </div>
                    {!suggestion.error ? (
                      <>
                        {suggestion.target_name && (
                          <p className="text-sm mb-1">
                            <span className="text-muted-foreground">Target:</span>{' '}
                            <span className="font-medium">{suggestion.target_name}</span>
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
                      </>
                    ) : (
                      <p className="text-sm text-destructive">{suggestion.error}</p>
                    )}
                  </div>
                  
                  {!suggestion.error && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(index)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        ))}
      </div>

      {validSuggestions.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No valid suggestions to apply.</p>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleApply} disabled={validSuggestions.length === 0}>
          Continue to Import ({validSuggestions.length} mappings)
        </Button>
      </div>
    </div>
  );
};

const EditSuggestionForm = ({ 
  suggestion, 
  onSave, 
  onCancel 
}: { 
  suggestion: any; 
  onSave: (updates: any) => void; 
  onCancel: () => void;
}) => {
  const [action, setAction] = useState(suggestion.action);
  const [targetName, setTargetName] = useState(suggestion.target_name || '');

  return (
    <div className="space-y-4">
      <div>
        <Label>Action</Label>
        <NativeSelect 
          value={action} 
          onChange={(e) => setAction(e.target.value)}
        >
          <option value="create_segment">Create Segment</option>
          <option value="map_to_segment">Map to Segment</option>
          <option value="create_persona">Create Persona</option>
          <option value="map_to_persona">Map to Persona</option>
          <option value="skip">Skip</option>
        </NativeSelect>
      </div>

      <div>
        <Label>Target Name</Label>
        <Input
          value={targetName}
          onChange={(e) => setTargetName(e.target.value)}
          placeholder="Enter target name"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave({ action, target_name: targetName })}>
          Save Changes
        </Button>
      </div>
    </div>
  );
};
