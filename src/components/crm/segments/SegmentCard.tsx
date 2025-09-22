
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Users, Trash2, MoreHorizontal } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Segment {
  id: string;
  name: string;
  description?: string;
  conditions: any;
  customer_count: number;
  auto_update: boolean;
  created_at: string;
}

interface SegmentCardProps {
  segment: Segment;
  onDelete: (segmentId: string) => Promise<boolean>;
}

export const SegmentCard: React.FC<SegmentCardProps> = ({ segment, onDelete }) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await onDelete(segment.id);
    setIsDeleting(false);
    if (success) {
      setShowDeleteDialog(false);
    }
  };

  const getFilterCount = () => {
    return segment.conditions?.filters?.length || 0;
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{segment.name}</CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {segment.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {segment.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0 flex flex-col h-full">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {segment.customer_count} customers
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {getFilterCount()} {getFilterCount() === 1 ? 'filter' : 'filters'}
              </Badge>
              {segment.auto_update && (
                <Badge variant="outline">Auto-update</Badge>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground">
              Created {new Date(segment.created_at).toLocaleDateString()}
            </div>
          </div>
            
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
            >
              View Details
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
            >
              Create Campaign
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Segment"
        description={`Are you sure you want to delete "${segment.name}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </>
  );
};
