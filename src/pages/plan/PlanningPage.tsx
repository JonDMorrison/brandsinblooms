import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlanningHeader } from '@/components/plan/PlanningHeader';
import { usePlannerMonth } from '@/hooks/usePlannerMonth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lightbulb, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

// Mock data fetcher - replace with your actual API
const fetchPlannerData = async (monthStartISO: string) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock response - replace with actual API call
  return {
    contentIdeas: [
      { id: '1', title: 'Blog post about seasonal trends', type: 'blog' },
      { id: '2', title: 'Social media campaign for holidays', type: 'social' },
      { id: '3', title: 'Email newsletter with monthly updates', type: 'email' },
    ],
    scheduledItems: [
      { id: '4', title: 'Product launch announcement', scheduledDate: '2025-09-15' },
      { id: '5', title: 'Webinar registration opens', scheduledDate: '2025-09-20' },
    ]
  };
};

const PlanningPage: React.FC = () => {
  const navigate = useNavigate();
  const { month, setMonth, monthLabel, monthStartISO } = usePlannerMonth();
  
  // Query for planner data - refetches when monthStartISO changes
  const planQuery = useQuery({
    queryKey: ['planner', monthStartISO],
    queryFn: () => fetchPlannerData(monthStartISO),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleMonthChange = (newMonth: Date) => {
    setMonth(newMonth);
    // TanStack Query will automatically refetch due to queryKey change
  };

  const handleGenerateContent = () => {
    // Navigate to content generation or trigger generation modal
    console.log('Generate content for', monthLabel);
  };

  const renderContent = () => {
    if (planQuery.isLoading) {
      return (
        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (planQuery.isError) {
      return (
        <Alert className="rounded-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load content for {monthLabel}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => planQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    const data = planQuery.data;
    const hasContent = data && (data.contentIdeas.length > 0 || data.scheduledItems.length > 0);

    if (!hasContent) {
      return (
        <Card className="rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Lightbulb className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">No content planned yet</h3>
                <p className="text-sm text-muted-foreground">
                  Generate content ideas and start planning for {monthLabel}
                </p>
              </div>
              <Button onClick={handleGenerateContent} className="mt-4">
                <Lightbulb className="h-4 w-4 mr-2" />
                Generate content for {monthLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* Content Ideas */}
        {data.contentIdeas.length > 0 && (
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <h3 className="font-medium mb-4">Content Ideas</h3>
              <div className="space-y-3">
                {data.contentIdeas.map((idea) => (
                  <div key={idea.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{idea.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{idea.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scheduled Items */}
        {data.scheduledItems.length > 0 && (
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <h3 className="font-medium mb-4">Scheduled Items</h3>
              <div className="space-y-3">
                {data.scheduledItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.scheduledDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30">
      <div className="container mx-auto px-4 py-8">
        {/* Header Navigation */}
        <div className="max-w-4xl mx-auto mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-2 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Planning Header */}
          <PlanningHeader 
            value={month}
            onChange={handleMonthChange}
          />

          {/* Content Section */}
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default PlanningPage;