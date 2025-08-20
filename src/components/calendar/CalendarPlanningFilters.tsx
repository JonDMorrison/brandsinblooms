import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Eye, EyeOff } from 'lucide-react';

interface CalendarPlanningFiltersProps {
  filters: {
    types: string[];
    platforms: string[];
    statuses: string[];
    showPublished: boolean;
    searchQuery: string;
  };
  onFiltersChange: (filters: any) => void;
  filterOptions: {
    types: string[];
    platforms: string[];
    statuses: string[];
  };
}

export const CalendarPlanningFilters = ({
  filters,
  onFiltersChange,
  filterOptions
}: CalendarPlanningFiltersProps) => {
  const typeLabels: Record<string, string> = {
    task: 'Content Tasks',
    scheduled_post: 'Scheduled Posts',
    newsletter: 'Newsletters',
    event: 'Events',
    holiday: 'Holidays'
  };

  const platformLabels: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    blog: 'Blog',
    video: 'Video',
    newsletter: 'Email'
  };

  const statusLabels: Record<string, string> = {
    planned: 'Planned',
    review: 'In Review',
    approved: 'Approved',
    scheduled: 'Scheduled',
    completed: 'Completed',
    QUEUED: 'Queued',
    PUBLISHED: 'Published',
    draft: 'Draft',
    sent: 'Sent'
  };

  const handleTypeToggle = (type: string, checked: boolean) => {
    const newTypes = checked 
      ? [...filters.types, type]
      : filters.types.filter(t => t !== type);
    onFiltersChange({ ...filters, types: newTypes });
  };

  const handlePlatformToggle = (platform: string, checked: boolean) => {
    const newPlatforms = checked
      ? [...filters.platforms, platform]
      : filters.platforms.filter(p => p !== platform);
    onFiltersChange({ ...filters, platforms: newPlatforms });
  };

  const handleStatusToggle = (status: string, checked: boolean) => {
    const newStatuses = checked
      ? [...filters.statuses, status]
      : filters.statuses.filter(s => s !== status);
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="w-4 h-4" />
            Search
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Input
            placeholder="Search content..."
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ ...filters, searchQuery: e.target.value })}
            className="h-8"
          />
        </CardContent>
      </Card>

      {/* Show Published Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {filters.showPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <Label htmlFor="show-published" className="text-sm">
                Show Published Content
              </Label>
            </div>
            <Switch
              id="show-published"
              checked={filters.showPublished}
              onCheckedChange={(checked) => onFiltersChange({ ...filters, showPublished: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Content Types */}
      {filterOptions.types.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Content Types</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {filterOptions.types.map(type => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={filters.types.includes(type)}
                  onCheckedChange={(checked) => handleTypeToggle(type, checked as boolean)}
                />
                <Label htmlFor={`type-${type}`} className="text-sm">
                  {typeLabels[type] || type}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Platforms */}
      {filterOptions.platforms.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Platforms</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {filterOptions.platforms.map(platform => (
              <div key={platform} className="flex items-center space-x-2">
                <Checkbox
                  id={`platform-${platform}`}
                  checked={filters.platforms.length === 0 || filters.platforms.includes(platform)}
                  onCheckedChange={(checked) => handlePlatformToggle(platform, checked as boolean)}
                />
                <Label htmlFor={`platform-${platform}`} className="text-sm">
                  {platformLabels[platform] || platform}
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Statuses */}
      {filterOptions.statuses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {filterOptions.statuses.map(status => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status}`}
                  checked={filters.statuses.length === 0 || filters.statuses.includes(status)}
                  onCheckedChange={(checked) => handleStatusToggle(status, checked as boolean)}
                />
                <Label htmlFor={`status-${status}`} className="text-sm flex items-center gap-2">
                  {statusLabels[status] || status}
                  <Badge variant="outline" className="text-xs">
                    {filters.statuses.length === 0 ? 'All' : filters.statuses.includes(status) ? 'On' : 'Off'}
                  </Badge>
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="pt-2 text-xs text-muted-foreground">
        {filters.types.length === 0 && filters.platforms.length === 0 && filters.statuses.length === 0 
          ? 'Showing all content' 
          : 'Filters active - some content may be hidden'
        }
      </div>
    </div>
  );
};