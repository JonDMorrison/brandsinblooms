import React, { useState, useEffect, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, SortAsc, Calendar, Image, Send, CheckCircle, Facebook, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'APPROVED';
  caption: string;
  mediaUrl?: string;
  platform?: string;
  campaignId?: string;
  createdAt: string;
  scheduledDate?: string;
  publishedAt?: string;
}

interface EnhancedComposerTrayProps {
  content: GeneratedContent[];
  selectedContent: GeneratedContent | null;
  onContentSelect: (content: GeneratedContent) => void;
  imageLoadingStates?: Record<string, boolean>;
  onQuickPublish?: (content: GeneratedContent) => void;
  onQuickSchedule?: (content: GeneratedContent) => void;
}

// Enhanced thumbnail with loading states and platform indicators
const EnhancedThumbnail = ({ 
  content, 
  isLoading = false 
}: { 
  content: GeneratedContent; 
  isLoading?: boolean;
}) => {
  const [imageError, setImageError] = useState(false);
  
  const getPlatformIcon = () => {
    switch (content.platform) {
      case 'facebook':
        return <Facebook className="w-3 h-3 text-blue-600" />;
      case 'instagram':
        return <Instagram className="w-3 h-3 text-pink-500" />;
      default:
        return <Send className="w-3 h-3 text-gray-400" />;
    }
  };
  
  if (isLoading) {
    return (
      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center relative overflow-hidden">
        <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
        <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5">
          {getPlatformIcon()}
        </div>
      </div>
    );
  }
  
  if (imageError || !content.mediaUrl) {
    return (
      <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center relative">
        <Image className="w-6 h-6 text-gray-400" />
        <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5">
          {getPlatformIcon()}
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-16 h-16 rounded-lg overflow-hidden relative">
      <img
        src={content.mediaUrl}
        alt="Content preview"
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
      <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5">
        {getPlatformIcon()}
      </div>
    </div>
  );
};

// Enhanced status badge with animations and better colors
const EnhancedStatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return { 
          color: 'bg-gray-100 text-gray-700 border-gray-200', 
          icon: null,
          pulse: false 
        };
      case 'APPROVED':
        return { 
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200', 
          icon: <CheckCircle className="w-3 h-3" />,
          pulse: true 
        };
      case 'SCHEDULED':
        return { 
          color: 'bg-blue-50 text-blue-700 border-blue-200', 
          icon: <Calendar className="w-3 h-3" />,
          pulse: false 
        };
      case 'PUBLISHED':
        return { 
          color: 'bg-green-50 text-green-700 border-green-200', 
          icon: <Send className="w-3 h-3" />,
          pulse: false 
        };
      default:
        return { 
          color: 'bg-gray-100 text-gray-700 border-gray-200', 
          icon: null,
          pulse: false 
        };
    }
  };
  
  const config = getStatusConfig(status);
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-xs border flex items-center gap-1",
        config.color,
        config.pulse && "animate-pulse"
      )}
    >
      {config.icon}
      {status}
    </Badge>
  );
};

// Quick action buttons for each content item
const QuickActions = ({ 
  content, 
  onQuickPublish, 
  onQuickSchedule 
}: { 
  content: GeneratedContent;
  onQuickPublish?: (content: GeneratedContent) => void;
  onQuickSchedule?: (content: GeneratedContent) => void;
}) => {
  if (content.status !== 'APPROVED') return null;
  
  return (
    <div className="flex items-center gap-1 mt-2">
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          onQuickPublish?.(content);
        }}
        className="h-6 px-2 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
      >
        <Send className="w-3 h-3 mr-1" />
        Publish
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          onQuickSchedule?.(content);
        }}
        className="h-6 px-2 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
      >
        <Calendar className="w-3 h-3 mr-1" />
        Schedule
      </Button>
    </div>
  );
};

export const EnhancedComposerTray = ({ 
  content, 
  selectedContent, 
  onContentSelect, 
  imageLoadingStates = {},
  onQuickPublish,
  onQuickSchedule
}: EnhancedComposerTrayProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');

  // Enhanced filtering and sorting
  const filteredAndSortedContent = useMemo(() => {
    let filtered = content.filter(item => {
      const matchesSearch = item.caption.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesPlatform = platformFilter === 'all' || item.platform === platformFilter;
      
      return matchesSearch && matchesStatus && matchesPlatform;
    });

    // Sort the content
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        case 'platform':
          return (a.platform || '').localeCompare(b.platform || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [content, searchTerm, statusFilter, platformFilter, sortBy]);

  // Statistics for the header
  const stats = useMemo(() => {
    const approved = content.filter(c => c.status === 'APPROVED').length;
    const scheduled = content.filter(c => c.status === 'SCHEDULED').length;
    const published = content.filter(c => c.status === 'PUBLISHED').length;
    
    return { approved, scheduled, published, total: content.length };
  }, [content]);

  const truncateCaption = (caption: string, maxLength: number = 50) => {
    if (caption.length <= maxLength) return caption;
    return caption.substring(0, maxLength) + '…';
  };

  const formatRelativeTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden">
      {/* Enhanced Header with Stats */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Content Library</h2>
          <Badge variant="outline" className="text-xs">
            {filteredAndSortedContent.length} of {stats.total}
          </Badge>
        </div>
        
        {/* Stats Row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span className="text-xs text-gray-600">{stats.approved} ready</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-xs text-gray-600">{stats.scheduled} scheduled</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs text-gray-600">{stats.published} published</span>
          </div>
        </div>

        {/* Enhanced Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">By Date</SelectItem>
                <SelectItem value="status">By Status</SelectItem>
                <SelectItem value="platform">By Platform</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Enhanced Content List */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3">
            {filteredAndSortedContent.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {searchTerm || statusFilter !== 'all' || platformFilter !== 'all' ? (
                    <Filter className="w-8 h-8 text-gray-400" />
                  ) : (
                    <Send className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                  {searchTerm || statusFilter !== 'all' || platformFilter !== 'all' 
                    ? 'No content matches your filters' 
                    : 'No content available'
                  }
                </h3>
                <p className="text-gray-600 text-sm">
                  {searchTerm || statusFilter !== 'all' || platformFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Generate and approve content to start publishing'
                  }
                </p>
              </div>
            ) : (
              filteredAndSortedContent.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onContentSelect(item)}
                  className={cn(
                    "group flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all duration-200",
                    "hover:shadow-md hover:border-primary/30",
                    selectedContent?.id === item.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-gray-200 bg-white hover:bg-primary/5"
                  )}
                >
                  {/* Enhanced Thumbnail */}
                  <EnhancedThumbnail 
                    content={item}
                    isLoading={imageLoadingStates[item.id]}
                  />

                  {/* Enhanced Content Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900 text-sm leading-tight line-clamp-2">
                        {truncateCaption(item.caption)}
                      </h3>
                    </div>
                    
                    <EnhancedStatusBadge status={item.status} />
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(item.createdAt)}
                    </span>

                    {/* Quick Actions for approved content */}
                    <QuickActions
                      content={item}
                      onQuickPublish={onQuickPublish}
                      onQuickSchedule={onQuickSchedule}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};