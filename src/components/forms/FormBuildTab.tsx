import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FormField, FormFieldType } from '@/types/formBuilder';
import { DraggableFieldList } from './DraggableFieldList';
import { AddFieldPanel } from './AddFieldPanel';
import { FormTemplatesDialog } from './FormTemplatesDialog';

interface FormBuildTabProps {
  fields: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
  onApplyTemplate?: (templateData: any) => void;
}

export function FormBuildTab({ fields, onFieldsChange, onApplyTemplate }: FormBuildTabProps) {
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const addField = (type: FormFieldType) => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type,
      label: type === 'email_consent' ? 'I agree to receive marketing emails' 
           : type === 'sms_consent' ? 'I agree to receive SMS messages. Msg & data rates may apply.'
           : `New ${type} field`,
      required: type === 'email' || type === 'email_consent' || type === 'sms_consent',
      placeholder: type === 'email' ? 'you@example.com' 
                 : type === 'phone' ? '(555) 123-4567'
                 : type === 'text' ? 'Enter your answer...'
                 : '',
      mapping_key: type === 'email' ? 'email' 
                 : type === 'phone' ? 'phone'
                 : type === 'email_consent' ? 'email_consent'
                 : type === 'sms_consent' ? 'sms_consent'
                 : 'custom',
      options: type === 'select' ? ['Option 1', 'Option 2', 'Option 3'] : undefined,
    };
    onFieldsChange([...fields, newField]);
  };

  const handleTemplateSelect = (templateData: any) => {
    if (onApplyTemplate) {
      onApplyTemplate(templateData);
    } else {
      // Fallback: just apply the fields
      if (templateData.fields_json) {
        onFieldsChange(templateData.fields_json);
      }
    }
    setTemplatesOpen(false);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fields List - Main Area */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Form Fields</CardTitle>
              <CardDescription>
                Drag fields to reorder. Click a field to expand and edit its properties.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DraggableFieldList 
                fields={fields} 
                onFieldsChange={onFieldsChange} 
              />
            </CardContent>
          </Card>
        </div>

        {/* Add Field Panel - Sidebar */}
        <div>
          <AddFieldPanel 
            onAddField={addField}
            onOpenTemplates={() => setTemplatesOpen(true)}
            existingFields={fields}
          />
        </div>
      </div>

      {/* Templates Dialog */}
      <FormTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onSelect={handleTemplateSelect}
      />
    </>
  );
}
