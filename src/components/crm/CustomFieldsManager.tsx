import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Edit2 } from 'lucide-react';

interface CustomFieldsManagerProps {
  customerId: string;
  customFields: Record<string, any>;
  onFieldsUpdate: () => void;
}

export const CustomFieldsManager: React.FC<CustomFieldsManagerProps> = ({
  customerId,
  customFields = {},
  onFieldsUpdate,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentFieldKey, setCurrentFieldKey] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleOpenDialog = (key?: string) => {
    if (key) {
      setIsEditing(true);
      setCurrentFieldKey(key);
      setFieldName(key);
      setFieldValue(customFields[key] || '');
    } else {
      setIsEditing(false);
      setCurrentFieldKey('');
      setFieldName('');
      setFieldValue('');
    }
    setIsDialogOpen(true);
  };

  const handleSaveField = async () => {
    if (!fieldName.trim()) {
      toast({
        title: 'Field name required',
        description: 'Please enter a field name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const updatedFields = { ...customFields };
      
      // If editing and field name changed, delete old key
      if (isEditing && currentFieldKey !== fieldName) {
        delete updatedFields[currentFieldKey];
      }
      
      updatedFields[fieldName] = fieldValue;

      const { error } = await supabase
        .from('crm_customers')
        .update({
          custom_fields: updatedFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      if (error) throw error;

      toast({
        title: 'Field saved',
        description: `Custom field "${fieldName}" has been ${isEditing ? 'updated' : 'added'}.`,
      });

      setIsDialogOpen(false);
      onFieldsUpdate();
    } catch (error) {
      console.error('Error saving field:', error);
      toast({
        title: 'Error saving field',
        description: 'There was a problem saving the custom field.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteField = async (key: string) => {
    try {
      const updatedFields = { ...customFields };
      delete updatedFields[key];

      const { error } = await supabase
        .from('crm_customers')
        .update({
          custom_fields: updatedFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      if (error) throw error;

      toast({
        title: 'Field deleted',
        description: `Custom field "${key}" has been removed.`,
      });

      onFieldsUpdate();
    } catch (error) {
      console.error('Error deleting field:', error);
      toast({
        title: 'Error deleting field',
        description: 'There was a problem deleting the custom field.',
        variant: 'destructive',
      });
    }
  };

  const fieldEntries = Object.entries(customFields);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            Custom Fields
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenDialog()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fieldEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No custom fields yet. Click "Add Field" to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {fieldEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="font-medium text-sm text-muted-foreground">
                      {key}
                    </div>
                    <div className="text-base">
                      {value?.toString() || '-'}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(key)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteField(key)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit' : 'Add'} Custom Field</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the field name and value.'
                : 'Add a new custom field to this customer.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fieldName">Field Name</Label>
              <Input
                id="fieldName"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="e.g., Birthday, Company, Notes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fieldValue">Field Value</Label>
              <Input
                id="fieldValue"
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                placeholder="Enter the value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveField} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
