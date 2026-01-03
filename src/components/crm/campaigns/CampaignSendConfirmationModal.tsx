import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, Users, Tag, Layers } from 'lucide-react';

interface SelectedSegment {
  id: string;
  name: string;
  customerCount?: number;
}

interface SelectedPersona {
  id: string;
  name: string;
  customerCount?: number;
}

interface CampaignSendConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  campaignName: string;
  subjectLine: string;
  selectedSegments: SelectedSegment[];
  selectedPersonas: SelectedPersona[];
  totalContacts: number;
  loading?: boolean;
}

export const CampaignSendConfirmationModal: React.FC<CampaignSendConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  campaignName,
  subjectLine,
  selectedSegments,
  selectedPersonas,
  totalContacts,
  loading = false
}) => {
  const hasAudience = selectedSegments.length > 0 || selectedPersonas.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Are you sure?
          </DialogTitle>
          <DialogDescription>
            You're about to send this campaign. Please review the details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Campaign Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Campaign</p>
              <p className="text-sm font-medium">{campaignName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Subject Line</p>
              <p className="text-sm">{subjectLine}</p>
            </div>
          </div>

          {/* Audience Summary */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Audience</span>
            </div>

            {hasAudience ? (
              <div className="space-y-2">
                {selectedSegments.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Layers className="h-3 w-3" />
                      <span>Segments</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSegments.map((segment) => (
                        <span
                          key={segment.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800"
                        >
                          {segment.name}
                          {segment.customerCount !== undefined && (
                            <span className="ml-1 text-blue-600">({segment.customerCount})</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPersonas.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" />
                      <span>Personas</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPersonas.map((persona) => (
                        <span
                          key={persona.id}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800"
                        >
                          {persona.name}
                          {persona.customerCount !== undefined && (
                            <span className="ml-1 text-purple-600">({persona.customerCount})</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All Contacts</p>
            )}

            {/* Total Recipients */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total recipients</span>
                <span className="text-lg font-semibold text-primary">{totalContacts.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Sending..." : "Send Campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
