import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, MoreVertical, Edit2, Trash2, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SegmentCardProps {
  segment: {
    id: string;
    name: string;
    description?: string;
    customer_count: number;
    type: 'predefined' | 'custom';
    created_at?: string;
  };
  onEdit?: (segmentId: string) => void;
  onDelete?: (segmentId: string, segmentType: string) => void;
}

export const SegmentCard: React.FC<SegmentCardProps> = ({
  segment,
  onEdit,
  onDelete
}) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          {segment.name}
          {segment.type === 'predefined' && (
            <Sparkles className="h-3 w-3 text-yellow-600" />
          )}
        </CardTitle>
        
        {segment.type === 'custom' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(segment.id)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete?.(segment.id, segment.type)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {segment.description || 'No description provided'}
          </p>
          
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              {segment.customer_count} customers
            </Badge>
            
            {segment.created_at && segment.type === 'custom' && (
              <span className="text-xs text-muted-foreground">
                Created {formatDate(segment.created_at)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};