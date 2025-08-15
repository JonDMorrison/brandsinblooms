import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Sparkles,
  Leaf
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
      icon: <Sparkles className="w-6 h-6 text-indigo-600" />,
      gradient: 'from-indigo-50 to-indigo-100',
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
      gradient: 'from-blue-50 to-blue-100',
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
      icon: <Megaphone className="w-6 h-6 text-green-600" />,
      gradient: 'from-green-50 to-green-100',
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
      icon: <Share2 className="w-6 h-6 text-pink-600" />,
      gradient: 'from-pink-50 to-pink-100',
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
      icon: <Globe className="w-6 h-6 text-teal-600" />,
      gradient: 'from-teal-50 to-teal-100',
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

  const dashboardCards = [
    {
      title: 'Create & Post',
      description: 'Events, holidays, or your own idea—AI will draft everything.',
      icon: Sparkles,
      gradient: 'from-purple-500 to-pink-500',
      iconBg: 'bg-purple-500',
      buttonColor: 'bg-pink-500 hover:bg-pink-600',
      primaryAction: 'Get Started',
      secondaryAction: 'Browse Post Content',
      status: 'Assistant ready',
      onClick: () => setShowCreateFlow(true),
      onSecondaryClick: () => navigate('/content/library')
    },
    {
      title: 'Send a Newsletter',
      description: 'Create and send email campaigns to your customers with personalized content.',
      icon: Mail,
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-500',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      primaryAction: 'Create Newsletter',
      secondaryAction: 'Browse Templates',
      status: 'Automat ready',
      onClick: () => navigate('/newsletters/new'),
      onSecondaryClick: () => setShowNewsletterDrawer(true)
    },
    {
      title: 'Build a Campaign',
      description: 'Design automated customer journeys with SMS, email sequences.',
      icon: Megaphone,
      gradient: 'from-green-500 to-emerald-500',
      iconBg: 'bg-green-500',
      buttonColor: 'bg-green-600 hover:bg-green-700',
      primaryAction: 'Build Campaign',
      secondaryAction: 'View Automations',
      status: twilioStatus.statusMessage,
      onClick: () => navigate('/crm/automations/new?mode=quick'),
      onSecondaryClick: () => navigate('/crm/automations')
    },
    {
      title: 'Plan Your Content Calendar',
      description: 'Schedule posts, campaigns, and content across all your marketing channels.',
      icon: Calendar,
      gradient: 'from-indigo-500 to-purple-500',
      iconBg: 'bg-indigo-500',
      buttonColor: 'bg-purple-600 hover:bg-purple-700',
      primaryAction: 'Open Calendar',
      secondaryAction: 'Quick Schedule',
      status: 'Calendar ready',
      onClick: () => navigate('/calendar'),
      onSecondaryClick: () => navigate('/publish')
    },
    {
      title: 'Track Your Progress',
      description: 'Monitor campaign performance, customer engagement, and ROI.',
      icon: BarChart3,
      gradient: 'from-purple-500 to-indigo-500',
      iconBg: 'bg-purple-500',
      buttonColor: 'bg-blue-600 hover:bg-blue-700',
      primaryAction: 'View Analytics',
      secondaryAction: 'Customer Insights',
      status: 'Analytics available',
      onClick: () => navigate('/analytics'),
      onSecondaryClick: () => navigate('/crm/personas/analytics')
    },
    {
      title: 'Post on Social Media',
      description: 'Create, schedule, and publish content across all your social media platforms.',
      icon: Share2,
      gradient: 'from-teal-500 to-green-500',
      iconBg: 'bg-teal-500',
      buttonColor: 'bg-green-600 hover:bg-green-700',
      primaryAction: 'Create Post',
      secondaryAction: 'Manage Accounts',
      status: socialStatus.statusMessage,
      onClick: () => setShowPostComposer(true),
      onSecondaryClick: () => navigate('/social-accounts')
    }
  ];

  return (
    <div className="animate-fadeScaleIn">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Leaf className="w-8 h-8 text-brand-green" />
          <h1 className="font-heading text-2xl md:text-3xl text-ink-1">BloomSuite Dashboard</h1>
        </div>
        <p className="text-ink-2 mb-4">Your complete marketing command center</p>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm"
            className="bg-white/5 border-white/10 text-ink-2 hover:bg-white/10"
          >
            Not sure where to start?
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="bg-white/5 border-white/10 text-ink-2 hover:bg-white/10"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Get Help
          </Button>
        </div>
      </div>

      {/* Main Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {dashboardCards.map((card) => (
          <div
            key={card.title}
            className="glass grad-border p-5 shadow-elev-2 transition-all duration-base ease-brand hover:-translate-y-0.5 hover:shadow-glow cursor-pointer group"
            onClick={card.onClick}
          >
            {/* Background gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-5 rounded-2xl pointer-events-none`} />
            
            {/* Content */}
            <div className="relative z-10">
              {/* Status badge */}
              <div className="flex items-center justify-between mb-4">
                <span className="status-pill">
                  {card.status}
                </span>
              </div>
              
              {/* Icon and title */}
              <div className="flex items-start gap-4 mb-4">
                <div className={`h-9 w-9 rounded-xl bg-grad-primary animate-pulse-glow flex items-center justify-center shadow-lg`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-lg text-ink-1 mb-2">{card.title}</h3>
                  <p className="text-sm text-ink-2 leading-relaxed">{card.description}</p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="space-y-3">
                <button 
                  className="btn-primary w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    card.onClick();
                  }}
                >
                  {card.primaryAction}
                </button>
                <button 
                  className="btn-ghost w-full text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    card.onSecondaryClick();
                  }}
                >
                  {card.secondaryAction} →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="glass grad-border p-6 rounded-2xl shadow-elev-2 mb-6">
        <div className="flex items-start gap-4">
          <div className="h-9 w-9 rounded-xl bg-grad-primary animate-pulse-glow flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading text-lg text-ink-1 mb-2">Build & Manage Website</h3>
            <p className="text-sm text-ink-2 mb-4">Use AI to build your site in just minutes. Create stunning, professional websites without any coding knowledge.</p>
            <div className="flex items-center gap-4">
              <button className="btn-primary">
                Join the Waitlist
              </button>
              <span className="text-sm text-ink-2">Feature coming soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-6 text-center">
        <p className="text-sm text-ink-2">
          Need help? Check out our{' '}
          <button className="text-brand-green hover:text-brand-teal transition-colors underline">
            getting started guide
          </button>
        </p>
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