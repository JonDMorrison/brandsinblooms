import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LaunchpadModal } from "@/components/dashboard/LaunchpadModal";
import { useConnectedAccounts, getConnectionStatus } from "@/components/dashboard/ConnectedAccountChecker";
import { useTwilioSetup, getTwilioStatus } from "@/components/dashboard/TwilioSetupChecker";
import { Button } from "@/components/ui/button";
import { 
  Mail, 
  Megaphone, 
  Calendar, 
  BarChart3, 
  Share2,
  HelpCircle,
  Sparkles
} from "lucide-react";

export const BloomSuiteDashboard = () => {
  const navigate = useNavigate();
  const [showLaunchpad, setShowLaunchpad] = useState(false);
  
  const { data: socialConnections = [], isLoading: loadingConnections } = useConnectedAccounts();
  const { data: twilioData, isLoading: loadingTwilio } = useTwilioSetup();
  
  const socialStatus = getConnectionStatus(socialConnections);
  const twilioStatus = getTwilioStatus(twilioData?.isSetup || false);

  const handleSelectAction = (action: string) => {
    switch (action) {
      case 'newsletter':
        navigate('/crm/campaigns/new');
        break;
      case 'social-post':
        navigate('/social-accounts');
        break;
      case 'campaign':
        navigate('/crm/campaigns/new');
        break;
      case 'content-calendar':
        navigate('/calendar');
        break;
      case 'dashboard':
      default:
        // Stay on current page
        break;
    }
  };

  const dashboardActions = [
    {
      id: 'newsletter',
      title: 'Send A Newsletter',
      description: 'Create and send email campaigns to your customers with personalized content and automated scheduling.',
      icon: <Mail className="w-6 h-6 text-blue-600" />,
      gradient: 'from-blue-50 to-blue-100',
      primaryAction: {
        label: 'Create Newsletter',
        onClick: () => navigate('/crm/campaigns/new')
      },
      secondaryAction: {
        label: 'Browse Templates',
        onClick: () => navigate('/crm/campaigns')
      },
      status: 'ready' as const,
      statusMessage: 'Email system ready'
    },
    {
      id: 'campaign',
      title: 'Build A Campaign',
      description: 'Design automated customer journeys with SMS, email sequences, and personalized messaging flows.',
      icon: <Megaphone className="w-6 h-6 text-green-600" />,
      gradient: 'from-green-50 to-green-100',
      primaryAction: {
        label: 'Build Campaign',
        onClick: () => navigate('/crm/campaigns/new')
      },
      secondaryAction: {
        label: 'View Automations',
        onClick: () => navigate('/automation')
      },
      status: twilioStatus.status,
      statusMessage: twilioStatus.statusMessage
    },
    {
      id: 'calendar',
      title: 'Plan Your Content Calendar',
      description: 'Schedule posts, campaigns, and content across all your marketing channels with visual planning tools.',
      icon: <Calendar className="w-6 h-6 text-orange-600" />,
      gradient: 'from-orange-50 to-orange-100',
      primaryAction: {
        label: 'Open Calendar',
        onClick: () => navigate('/calendar')
      },
      secondaryAction: {
        label: 'Quick Schedule',
        onClick: () => navigate('/publish')
      },
      status: 'ready' as const,
      statusMessage: 'Calendar ready'
    },
    {
      id: 'analytics',
      title: 'Track Your Progress',
      description: 'Monitor campaign performance, customer engagement, and ROI across all your marketing efforts.',
      icon: <BarChart3 className="w-6 h-6 text-purple-600" />,
      gradient: 'from-purple-50 to-purple-100',
      primaryAction: {
        label: 'View Analytics',
        onClick: () => navigate('/crm/analytics')
      },
      secondaryAction: {
        label: 'Customer Insights',
        onClick: () => navigate('/crm/personas/analytics')
      },
      status: 'ready' as const,
      statusMessage: 'Analytics available'
    },
    {
      id: 'social',
      title: 'Post On Social Media',
      description: 'Create, schedule, and publish content across all your social media platforms with AI assistance.',
      icon: <Share2 className="w-6 h-6 text-pink-600" />,
      gradient: 'from-pink-50 to-pink-100',
      primaryAction: {
        label: 'Create Post',
        onClick: () => navigate('/publish')
      },
      secondaryAction: {
        label: 'Manage Accounts',
        onClick: () => navigate('/social-accounts')
      },
      status: socialStatus.status,
      statusMessage: socialStatus.statusMessage
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-yellow-500" />
            <h1 className="text-4xl font-bold text-gray-900">BloomSuite Dashboard</h1>
          </div>
          <p className="text-xl text-gray-600 mb-6">
            Your complete marketing command center
          </p>
          <Button 
            variant="outline" 
            onClick={() => setShowLaunchpad(true)}
            className="mb-8"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Not sure where to start?
          </Button>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {dashboardActions.map((action) => (
            <DashboardCard
              key={action.id}
              title={action.title}
              description={action.description}
              icon={action.icon}
              gradient={action.gradient}
              primaryAction={action.primaryAction}
              secondaryAction={action.secondaryAction}
              status={action.status}
              statusMessage={action.statusMessage}
            />
          ))}
        </div>

        {/* Quick Stats or Recent Activity could go here */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Need help? Check out our{' '}
            <button 
              onClick={() => setShowLaunchpad(true)}
              className="text-blue-600 hover:text-blue-700 underline"
            >
              getting started guide
            </button>
          </p>
        </div>

      </div>

      {/* Getting Started Modal */}
      <LaunchpadModal 
        isOpen={showLaunchpad}
        onClose={() => setShowLaunchpad(false)}
        onSelectAction={handleSelectAction}
      />
    </div>
  );
};