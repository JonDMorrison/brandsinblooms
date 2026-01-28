import React, { useState, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  GripVertical, 
  ChevronDown, 
  Mail, 
  Phone, 
  Type, 
  List,
  CheckSquare,
  EyeOff,
  ShieldCheck,
  MessageSquare,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { FormField, FormFieldType, FIELD_MAPPING_OPTIONS } from '@/types/formBuilder';
import { NativeSelect } from '@/components/ui/NativeSelect';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { reorderArray } from '@/utils/dragUtils';

interface DraggableFieldListProps {
  fields: FormField[];
  onFieldsChange: (fields: FormField[]) => void;
}

const FIELD_TYPE_CONFIG: Record<FormFieldType, { 
  icon: React.ElementType; 
  label: string; 
  color: string;
  helperText: string;
}> = {
  email: { 
    icon: Mail, 
    label: 'Email', 
    color: 'text-blue-600',
    helperText: 'Collects and validates email addresses'
  },
  text: { 
    icon: Type, 
    label: 'Text', 
    color: 'text-gray-600',
    helperText: 'Single-line text input for names, titles, etc.'
  },
  phone: { 
    icon: Phone, 
    label: 'Phone', 
    color: 'text-green-600',
    helperText: 'Collects phone numbers with format validation'
  },
  select: { 
    icon: List, 
    label: 'Dropdown', 
    color: 'text-purple-600',
    helperText: 'Let users choose from predefined options'
  },
  checkbox: { 
    icon: CheckSquare, 
    label: 'Checkbox', 
    color: 'text-orange-600',
    helperText: 'Single yes/no option'
  },
  hidden: { 
    icon: EyeOff, 
    label: 'Hidden', 
    color: 'text-gray-400',
    helperText: 'Invisible field for tracking data'
  },
  email_consent: { 
    icon: ShieldCheck, 
    label: 'Email Consent', 
    color: 'text-primary',
    helperText: 'Required for email marketing (CASL compliant)'
  },
  sms_consent: { 
    icon: MessageSquare, 
    label: 'SMS Consent', 
    color: 'text-primary',
    helperText: 'Required for SMS marketing (TCPA compliant)'
  },
};

export function DraggableFieldList({ fields, onFieldsChange }: DraggableFieldListProps) {
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    const reordered = reorderArray(fields, result.source.index, result.destination.index);
    onFieldsChange(reordered);
  }, [fields, onFieldsChange]);

  const updateField = (id: string, updates: Partial<FormField>) => {
    onFieldsChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    onFieldsChange(fields.filter(f => f.id !== id));
  };

  if (fields.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-muted rounded-lg">
        <Type className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <h3 className="font-medium mb-1">No fields yet</h3>
        <p className="text-sm text-muted-foreground">
          Add fields from the right panel or choose a template.
        </p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="fields">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-2 transition-colors rounded-lg ${
              snapshot.isDraggingOver ? 'bg-muted/50' : ''
            }`}
          >
            {fields.map((field, index) => (
              <DraggableFieldItem
                key={field.id}
                field={field}
                index={index}
                onUpdate={(updates) => updateField(field.id, updates)}
                onRemove={() => removeField(field.id)}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

interface DraggableFieldItemProps {
  field: FormField;
  index: number;
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
}

function DraggableFieldItem({ field, index, onUpdate, onRemove }: DraggableFieldItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const config = FIELD_TYPE_CONFIG[field.type];
  const Icon = config.icon;

  const isConsentField = field.type === 'email_consent' || field.type === 'sms_consent';

  return (
    <Draggable draggableId={field.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`transition-shadow ${snapshot.isDragging ? 'shadow-lg' : ''}`}
        >
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className={`border rounded-lg bg-background ${snapshot.isDragging ? 'border-primary' : ''}`}>
              {/* Header */}
              <div className="flex items-center gap-2 p-3">
                {/* Drag Handle */}
                <div
                  {...provided.dragHandleProps}
                  className="p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Field Type Icon */}
                <div className={`p-1.5 rounded ${field.type.includes('consent') ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>

                {/* Field Info */}
                <CollapsibleTrigger asChild>
                  <button className="flex-1 text-left hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{field.label}</span>
                      {field.required && (
                        <Badge variant="outline" className="text-xs py-0">
                          Required
                        </Badge>
                      )}
                      {isConsentField && (
                        <Badge variant="default" className="text-xs py-0 bg-primary/10 text-primary border-primary/20">
                          Compliance
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{config.label}</span>
                  </button>
                </CollapsibleTrigger>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={onRemove}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove field</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>

              {/* Expanded Editor */}
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-4 border-t bg-muted/20">
                  {/* Helper text for field type */}
                  <p className="text-xs text-muted-foreground pt-3 flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" />
                    {config.helperText}
                  </p>

                  {/* Label & Mapping */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`label-${field.id}`} className="text-xs font-medium">
                        Field Label
                      </Label>
                      <Input
                        id={`label-${field.id}`}
                        value={field.label}
                        onChange={(e) => onUpdate({ label: e.target.value })}
                        className="mt-1"
                        placeholder="Enter a clear label..."
                      />
                    </div>
                    <div>
                      <Label htmlFor={`mapping-${field.id}`} className="text-xs font-medium">
                        Maps to CRM Field
                      </Label>
                      <NativeSelect
                        label=""
                        value={field.mapping_key}
                        onChange={(e) => onUpdate({ mapping_key: e.target.value })}
                        options={FIELD_MAPPING_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Placeholder (for text inputs) */}
                  {!isConsentField && field.type !== 'checkbox' && field.type !== 'select' && (
                    <div>
                      <Label htmlFor={`placeholder-${field.id}`} className="text-xs font-medium">
                        Placeholder Text
                      </Label>
                      <Input
                        id={`placeholder-${field.id}`}
                        value={field.placeholder || ''}
                        onChange={(e) => onUpdate({ placeholder: e.target.value })}
                        placeholder="e.g., Enter your email..."
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Shown inside the field before user types
                      </p>
                    </div>
                  )}

                  {/* Dropdown Options */}
                  {field.type === 'select' && (
                    <div>
                      <Label className="text-xs font-medium">Dropdown Options</Label>
                      <textarea
                        className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm mt-1 bg-background"
                        value={(field.options || []).join('\n')}
                        onChange={(e) => onUpdate({ options: e.target.value.split('\n').filter(Boolean) })}
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        One option per line. Users will select from these choices.
                      </p>
                    </div>
                  )}

                  {/* Required Toggle with inline preview */}
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={field.required}
                        onCheckedChange={(checked) => onUpdate({ required: checked })}
                        disabled={isConsentField}
                      />
                      <div>
                        <Label className="text-sm">Required field</Label>
                        <p className="text-xs text-muted-foreground">
                          {isConsentField 
                            ? 'Consent fields are always required for compliance' 
                            : 'Users must fill this field to submit'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Inline Validation Preview */}
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground">Preview:</span>
                      <div className="flex items-center gap-1 text-xs mt-0.5">
                        <span className="font-medium">{field.label}</span>
                        {field.required && <span className="text-destructive">*</span>}
                      </div>
                    </div>
                  </div>

                  {/* Consent-specific warning */}
                  {isConsentField && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                        <div className="text-xs">
                          <p className="font-medium text-primary">Compliance Field</p>
                          <p className="text-muted-foreground mt-1">
                            {field.type === 'email_consent' 
                              ? 'This checkbox allows users to consent to email marketing. Required for CASL compliance in Canada and best practices everywhere.'
                              : 'This checkbox allows users to consent to SMS messages. Required for TCPA compliance in the US. Always include "Msg & data rates may apply."'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      )}
    </Draggable>
  );
}
