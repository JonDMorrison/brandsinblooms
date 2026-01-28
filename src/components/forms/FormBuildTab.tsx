import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Trash2, GripVertical, Plus, ChevronDown } from 'lucide-react';
import { FormField, FormFieldType, FIELD_MAPPING_OPTIONS } from '@/types/formBuilder';
import { NativeSelect } from '@/components/ui/NativeSelect';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FormBuildTabProps {
  fields: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
}

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'text', label: 'Text' },
  { value: 'phone', label: 'Phone' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'email_consent', label: 'Email Consent' },
  { value: 'sms_consent', label: 'SMS Consent' },
];

export function FormBuildTab({ fields, onFieldsChange }: FormBuildTabProps) {
  const addField = (type: FormFieldType) => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type,
      label: type === 'email_consent' ? 'I agree to receive marketing emails' 
           : type === 'sms_consent' ? 'I agree to receive SMS messages'
           : `New ${type} field`,
      required: type === 'email' || type === 'email_consent' || type === 'sms_consent',
      placeholder: '',
      mapping_key: type === 'email' ? 'email' 
                 : type === 'phone' ? 'phone'
                 : type === 'email_consent' ? 'email_consent'
                 : type === 'sms_consent' ? 'sms_consent'
                 : 'custom',
      options: type === 'select' ? ['Option 1', 'Option 2', 'Option 3'] : undefined,
    };
    onFieldsChange([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    onFieldsChange(
      fields.map(f => f.id === id ? { ...f, ...updates } : f)
    );
  };

  const removeField = (id: string) => {
    onFieldsChange(fields.filter(f => f.id !== id));
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    const newFields = [...fields];
    const [removed] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, removed);
    onFieldsChange(newFields);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Fields List */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Form Fields</CardTitle>
            <CardDescription>
              Drag to reorder. Click to expand and edit field properties.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No fields yet. Add a field from the right panel.
              </div>
            ) : (
              fields.map((field, index) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  index={index}
                  onUpdate={(updates) => updateField(field.id, updates)}
                  onRemove={() => removeField(field.id)}
                  onMoveUp={() => index > 0 && moveField(index, index - 1)}
                  onMoveDown={() => index < fields.length - 1 && moveField(index, index + 1)}
                  canMoveUp={index > 0}
                  canMoveDown={index < fields.length - 1}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Field Panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Add Field</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map((type) => (
              <Button
                key={type.value}
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => addField(type.value)}
              >
                <Plus className="h-3 w-3 mr-2" />
                {type.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface FieldEditorProps {
  field: FormField;
  index: number;
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function FieldEditor({
  field,
  index,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: FieldEditorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const getFieldTypeLabel = (type: FormFieldType) => {
    return FIELD_TYPES.find(t => t.value === type)?.label || type;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                  disabled={!canMoveUp}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-3 w-3 rotate-180" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                  disabled={!canMoveDown}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <div>
                <span className="font-medium">{field.label}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {getFieldTypeLabel(field.type)}
                  {field.required && ' • Required'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`label-${field.id}`}>Label</Label>
                <Input
                  id={`label-${field.id}`}
                  value={field.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`mapping-${field.id}`}>Maps to</Label>
                <NativeSelect
                  label=""
                  value={field.mapping_key}
                  onChange={(e) => onUpdate({ mapping_key: e.target.value })}
                  options={FIELD_MAPPING_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                />
              </div>
            </div>

            {field.type !== 'email_consent' && field.type !== 'sms_consent' && field.type !== 'checkbox' && (
              <div>
                <Label htmlFor={`placeholder-${field.id}`}>Placeholder</Label>
                <Input
                  id={`placeholder-${field.id}`}
                  value={field.placeholder || ''}
                  onChange={(e) => onUpdate({ placeholder: e.target.value })}
                  placeholder="Enter placeholder text..."
                />
              </div>
            )}

            {field.type === 'select' && (
              <div>
                <Label>Options (one per line)</Label>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm"
                  value={(field.options || []).join('\n')}
                  onChange={(e) => onUpdate({ options: e.target.value.split('\n').filter(Boolean) })}
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => onUpdate({ required: checked })}
              />
              <Label>Required field</Label>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
