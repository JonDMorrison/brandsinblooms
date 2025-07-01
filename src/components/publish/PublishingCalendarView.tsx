import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, BarChart3, TrendingUp, Clock, Settings, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, addDays, startOfWeek, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';


interface PublishingCalendarViewProps {
  onReschedule: (postId: string, newDate: Date) => void;
  onAnalyticsView: (postId: string) => void;
  onBulkAction: (postIds: string[], action: string) => void;
}

export const PublishingCalendarView = ({ 
  onReschedule, 
  onAnalyticsView, 
  onBulkAction 
}: PublishingCalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const { scheduledPosts, loading, reschedulePost, deleteScheduledPost } = useScheduledPosts();
  const [isDragging, setIsDragging] = useState(false);

  const generateCalendarDays = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      return Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i));
    }
  };

  const getPostsForDate = (date: Date) => {
    return scheduledPosts.filter(post => 
      isSameDay(new Date(post.publish_at), date)
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'QUEUED': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PUBLISHED': return 'bg-green-100 text-green-800 border-green-200';
      case 'ERROR': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      default: return '📄';
    }
  };

  const handlePostDrop = async (date: Date, postId: string) => {
    try {
      await reschedulePost(postId, date);
      onReschedule(postId, date);
    } catch (error) {
      console.error('Failed to reschedule post:', error);
    }
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPosts(prev => 
      prev.includes(postId) 
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    );
  };

  const handleBulkReschedule = () => {
    onBulkAction(selectedPosts, 'reschedule');
    setSelectedPosts([]);
  };

  const handleBulkDelete = async () => {
    for (const postId of selectedPosts) {
      await deleteScheduledPost(postId);
    }
    setSelectedPosts([]);
  };

  const days = generateCalendarDays();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <CardTitle>Publishing Calendar</CardTitle>
            <Badge variant="outline">{scheduledPosts.length} scheduled</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {selectedPosts.length > 0 && (
              <div className="flex items-center gap-2 mr-4">
                <span className="text-sm text-gray-600">{selectedPosts.length} selected</span>
                <Button size="sm" variant="outline" onClick={handleBulkReschedule}>
                  <Clock className="w-3 h-3 mr-1" />
                  Reschedule
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkDelete}>
                  Delete
                </Button>
              </div>
            )}
            
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                size="sm"
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                onClick={() => setViewMode('week')}
                className="px-3 py-1 text-xs"
              >
                Week
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                onClick={() => setViewMode('month')}
                className="px-3 py-1 text-xs"
              >
                Month
              </Button>
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentDate(viewMode === 'month' ? subMonths(currentDate, 1) : addDays(currentDate, -7))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : 'MMM d, yyyy')}
            </span>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentDate(viewMode === 'month' ? addMonths(currentDate, 1) : addDays(currentDate, 7))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="p-2 text-sm font-medium text-gray-600 text-center">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {days.map((date) => {
            const dayPosts = getPostsForDate(date);
            const isToday = isSameDay(date, new Date());
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            
            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "min-h-[100px] p-2 border border-gray-100 rounded-lg",
                  isToday && "bg-blue-50 border-blue-200",
                  !isCurrentMonth && "bg-gray-50 opacity-60",
                  isDragging && "border-dashed border-primary"
                )}
                onDragOver={(e) => e.preventDefault()}
              >
                <div className="text-xs font-medium text-gray-600 mb-1">
                  {format(date, 'd')}
                </div>
                
                <div className="space-y-1">
                  {dayPosts.map((post) => (
                    <div
                      key={post.id}
                      draggable
                      onDragStart={() => setIsDragging(true)}
                      onClick={() => togglePostSelection(post.id)}
                      className={cn(
                        "p-1.5 text-xs rounded border cursor-pointer transition-all hover:shadow-sm",
                        getStatusColor(post.status),
                        selectedPosts.includes(post.id) && "ring-2 ring-primary ring-opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span>{getPlatformIcon(post.platform)}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {post.status}
                        </Badge>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-4 w-4 p-0 ml-auto">
                              <MoreHorizontal className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => onAnalyticsView(post.id)}>
                              <BarChart3 className="w-3 h-3 mr-1" />
                              View Analytics
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onReschedule(post.id, date)}>
                              <Clock className="w-3 h-3 mr-1" />
                              Reschedule
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteScheduledPost(post.id)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <p className="line-clamp-2 text-[10px] text-gray-600">
                        {post.content?.caption?.substring(0, 40)}...
                      </p>
                      
                      <div className="text-[10px] text-gray-500 mt-1">
                        {format(new Date(post.publish_at), 'HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};