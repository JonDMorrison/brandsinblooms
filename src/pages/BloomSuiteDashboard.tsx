import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LaunchpadModal } from "@/components/dashboard/LaunchpadModal";
import { NewsletterTemplateDrawer } from "@/components/dashboard/NewsletterTemplateDrawer";
import { QuickStartTour } from "@/components/dashboard/QuickStartTour";
import { PostComposerModal } from "@/components/dashboard/PostComposerModal";
import { useConnectedAccounts, getConnectionStatus } from "@/components/dashboard/ConnectedAccountChecker";
import { useTwilioSetup, getTwilioStatus } from "@/components/dashboard/TwilioSetupChecker";
import { Button } from "@/components/ui/button";
import { 
  Mail, 
  Megaphone, 
  Calendar, 
  BarChart3, 
  Share2,
  Globe,
  HelpCircle,
  Sparkles
} from "lucide-react";
import { CreateFlowDialog } from "@/components/create-flow/CreateFlowDialog";

export const BloomSuiteDashboard = () => {
  const navigate = useNavigate();
  const [showLaunchpad, setShowLaunchpad] = useState(false);
  const [showNewsletterDrawer, setShowNewsletterDrawer] = useState(false);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [showQuickTour, setShowQuickTour] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  
  const { data: socialConnections = [], isLoading: loadingConnections } = useConnectedAccounts();
  const { data: twilioData, isLoading: loadingTwilio } = useTwilioSetup();

  // Check if user should see the quick start tour
  useEffect(() => {
    const tourDone = localStorage.getItem('dashboardTourDone');
    console.log('Tour check - tourDone:', tourDone, 'showQuickTour:', showQuickTour);
    if (!tourDone && !showQuickTour) {
      // Show tour after a brief delay to let the page load
      setTimeout(() => {
        console.log('Setting showQuickTour to true');
        setShowQuickTour(true);
      }, 1000);
    }
  }, [showQuickTour]);
  
  const socialStatus = getConnectionStatus(socialConnections);
  const twilioStatus = getTwilioStatus(twilioData?.isSetup || false);

  const handleSelectAction = (action: string) => {
    switch (action) {
      case 'newsletter':
        navigate('/crm/campaigns/new?type=newsletter');
        break;
      case 'social-post':
        setShowPostComposer(true);
        break;
      case 'campaign':
        navigate('/crm/automations/new?mode=quick');
        break;
      case 'content-calendar':
        navigate('/calendar');
        // Set flag for first-time calendar onboarding
        if (!localStorage.getItem('calendarOnboard')) {
          localStorage.setItem('calendarOnboard', 'true');
        }
        break;
      case 'dashboard':
      default:
        // Stay on current page
        break;
    }
  };

  const dashboardActions = [
    {
      id: 'create-flow',
      title: 'Create and Post Something',
      description: 'Events, holidays, or your own idea—AI will draft everything.',
      icon: <Sparkles className="w-6 h-6" />,
      variant: 'sage' as const,
      primaryAction: {
        label: 'Get Started',
        onClick: () => setShowCreateFlow(true)
      },
      secondaryAction: {
        label: 'Browse Past Content',
        onClick: () => navigate('/content/library')
      },
      status: 'ready' as const,
      statusMessage: 'AI assistant ready'
    },
    {
      id: 'newsletter',
      title: 'Send A Newsletter',
      description: 'Create and send email campaigns to your customers with personalized content and automated scheduling.',
      icon: <Mail className="w-6 h-6" />,
      variant: 'mint' as const,
      primaryAction: {
        label: 'Create Newsletter',
        onClick: () => navigate('/newsletters/new')
      },
      secondaryAction: {
        label: 'Browse Templates',
        onClick: () => setShowNewsletterDrawer(true)
      },
      status: 'ready' as const,
      statusMessage: 'Email system ready'
    },
    {
      id: 'campaign',
      title: 'Build A Campaign',
      description: 'Design automated customer journeys with SMS, email sequences, and personalized messaging flows.',
      icon: <Megaphone className="w-6 h-6" />,
      variant: 'forest' as const,
      primaryAction: {
        label: 'Build Campaign',
        onClick: () => navigate('/crm/automations/new?mode=quick')
      },
      secondaryAction: {
        label: 'View Automations',
        onClick: () => navigate('/crm/automations')
      },
      status: twilioStatus.status,
      statusMessage: twilioStatus.statusMessage
    },
    {
      id: 'calendar',
      title: 'Plan Your Content Calendar',
      description: 'Schedule posts, campaigns, and content across all your marketing channels with visual planning tools.',
      icon: <Calendar className="w-6 h-6" />,
      variant: 'cream' as const,
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
      icon: <BarChart3 className="w-6 h-6" />,
      variant: 'lavender' as const,
      primaryAction: {
        label: 'View Analytics',
        onClick: () => navigate('/analytics')
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
      icon: <Share2 className="w-6 h-6" />,
      variant: 'moss' as const,
      primaryAction: {
        label: 'Create Post',
        onClick: () => setShowPostComposer(true)
      },
      secondaryAction: {
        label: 'Manage Accounts',
        onClick: () => navigate('/social-accounts')
      },
      status: socialStatus.status,
      statusMessage: socialStatus.statusMessage
    },
    {
      id: 'website',
      title: 'Build & Manage Website',
      description: 'Use AI to build your site in just minutes. Create stunning, professional websites without any coding knowledge.',
      icon: <Globe className="w-6 h-6" />,
      variant: 'pearl' as const,
      primaryAction: {
        label: 'Join the Waitlist',
        onClick: () => navigate('/website')
      },
      secondaryAction: {
        label: 'Learn More',
        onClick: () => navigate('/website')
      },
      status: 'setup-needed' as const,
      statusMessage: 'Feature coming soon'
    }
  ];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 botanical-accent" />
            <h1 className="text-4xl font-bold botanical-heading">BloomSuite Dashboard</h1>
          </div>
          <p className="text-xl botanical-text mb-6">
            Your complete marketing command center
          </p>
          
          {/* Quick Help Banner */}
          <div className="glass rounded-2xl p-6 mb-8 max-w-md mx-auto">
            <p className="botanical-subheading text-sm mb-3">Not sure where to start?</p>
            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowQuickTour(true)}
                className="glass border-green-200 hover:bg-green-50"
              >
                <Sparkles className="w-4 h-4 mr-2 botanical-accent" />
                Quick Tour
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowLaunchpad(true)}
                className="glass border-green-200 hover:bg-green-50"
              >
                <HelpCircle className="w-4 h-4 mr-2 botanical-accent" />
                Get Help
              </Button>
            </div>
          </div>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {dashboardActions.map((action) => (
            <DashboardCard
              key={action.id}
              title={action.title}
              description={action.description}
              icon={action.icon}
              variant={action.variant}
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

      {/* Modals and Drawers */}
      <LaunchpadModal 
        isOpen={showLaunchpad}
        onClose={() => setShowLaunchpad(false)}
        onSelectAction={handleSelectAction}
      />

      <NewsletterTemplateDrawer
        isOpen={showNewsletterDrawer}
        onClose={() => setShowNewsletterDrawer(false)}
      />

      <PostComposerModal
        isOpen={showPostComposer}
        onClose={() => setShowPostComposer(false)}
      />

      <QuickStartTour
        isOpen={showQuickTour}
        onClose={() => setShowQuickTour(false)}
      />

      <CreateFlowDialog open={showCreateFlow} onOpenChange={setShowCreateFlow} />
    </div>
  );
};