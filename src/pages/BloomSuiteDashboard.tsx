import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { LaunchpadModal } from "@/components/dashboard/LaunchpadModal";
import { NewsletterTemplateDrawer } from "@/components/dashboard/NewsletterTemplateDrawer";
import { QuickStartTour } from "@/components/dashboard/QuickStartTour";
import { PostComposerModal } from "@/components/dashboard/PostComposerModal";
import { useConnectedAccounts, getConnectionStatus } from "@/components/dashboard/ConnectedAccountChecker";
import { useTwilioSetup, getTwilioStatus } from "@/components/dashboard/TwilioSetupChecker";
import { getDynamicIcon } from "@/components/dashboard/DynamicIcons";
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

  console.log('🏠 BloomSuiteDashboard: Rendering dashboard with loading states:', {
    loadingConnections,
    loadingTwilio,
    socialConnections: socialConnections.length
  });

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
      icon: <Sparkles className="w-6 h-6 text-indigo-600" />,
      
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
      icon: <Mail className="w-6 h-6 text-blue-600" />,
      
      primaryAction: {
        label: 'Create Newsletter',
        onClick: () => {
          console.log('Newsletter button clicked - navigating to:', '/newsletters/new');
          navigate('/newsletters/new');
        }
      },
      secondaryAction: {
        label: 'Previous Newsletters',
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
      icon: <Calendar className="w-6 h-6 text-orange-600" />,
      
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
      icon: <BarChart3 className="w-6 h-6" style={{ color: 'hsl(var(--brand-navy))' }} />,
      
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
      icon: <Share2 className="w-6 h-6" style={{ color: 'hsl(var(--brand-teal))' }} />,
      
      primaryAction: {
        label: 'Create Post',
        onClick: () => setShowPostComposer(true)
      },
      secondaryAction: {
        label: 'Manage Accounts',
        onClick: () => navigate('/social-accounts')
      },
      status: socialStatus.status,
      statusMessage: socialStatus.statusMessage,
      connectionCount: socialConnections.length
    },
    {
      id: 'website',
      title: 'Build & Manage Website',
      description: 'Use AI to build your site in just minutes. Create stunning, professional websites without any coding knowledge.',
      icon: <Globe className="w-6 h-6 text-teal-600" />,
      
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 p-6">
      <div className="max-w-6xl mx-auto">
        <div style={{ minHeight: '200px', backgroundColor: 'red', color: 'white', padding: '20px' }}>
          <h1>DEBUG: Dashboard should render here</h1>
          <p>Screen width: {typeof window !== 'undefined' ? window.innerWidth : 'unknown'}</p>
          <p>User agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}</p>
        </div>
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl font-bold text-gray-900">BloomSuite Dashboard</h1>
          </div>
          <p className="text-xl text-gray-600 mb-6">
            Your complete marketing command center
          </p>
          
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {dashboardActions.map((action, index) => {
            // Define botanical accents for variety
            const botanicalAccents = ['sage', 'mint', 'forest', 'earth'] as const;
            const accent = botanicalAccents[index % botanicalAccents.length];
            
            return (
              <DashboardCard
                key={action.id}
                title={action.title}
                description={action.description}
                icon={action.icon}
                primaryAction={action.primaryAction}
                secondaryAction={action.secondaryAction}
                status={action.status}
                statusMessage={action.statusMessage}
                variant="botanical"
                accent={accent}
                cardId={action.id}
                dynamicIcon={getDynamicIcon(action.id, action.status, (action as any).connectionCount)}
                hasPendingAction={false}
              />
            );
          })}
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