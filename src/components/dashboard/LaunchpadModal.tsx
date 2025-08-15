import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { 
  Mail, 
  Megaphone, 
  Calendar, 
  BarChart3, 
  Share2,
  ArrowRight,
  Sparkles
} from "lucide-react";

interface LaunchpadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (action: string) => void;
}

const quickStartOptions = [
  {
    id: 'newsletter',
    title: 'Send My First Newsletter',
    description: 'Quick email blast to your customers',
    icon: <Mail className="w-5 h-5" />,
    color: 'from-blue-50 to-blue-100',
    recommended: true
  },
  {
    id: 'social-post',
    title: 'Post on Social Media',
    description: 'Share content across your social channels',
    icon: <Share2 className="w-5 h-5" />,
    color: 'from-purple-50 to-purple-100'
  },
  {
    id: 'campaign',
    title: 'Build an Automation',
    description: 'Create a customer journey or SMS sequence',
    icon: <Megaphone className="w-5 h-5" />,
    color: 'from-green-50 to-green-100'
  },
  {
    id: 'content-calendar',
    title: 'Plan Content Calendar',
    description: 'Schedule posts and campaigns ahead of time',
    icon: <Calendar className="w-5 h-5" />,
    color: 'from-orange-50 to-orange-100'
  }
];

export const LaunchpadModal = ({ isOpen, onClose, onSelectAction }: LaunchpadModalProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleOptionSelect = (optionId: string) => {
    setSelectedOption(optionId);
    setTimeout(() => {
      onSelectAction(optionId);
      onClose();
    }, 200);
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={onClose}
      title="Getting Started with BloomSuite"
      description="Choose what you'd like to do first. You can always access these features from your dashboard."
      size="lg"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {quickStartOptions.map((option) => (
          <button
            key={option.id}
            className={`
              glass grad-border p-4 rounded-xl text-left transition-all duration-200
              hover:shadow-glow hover:-translate-y-0.5 cursor-pointer group
              ${selectedOption === option.id ? 'ring-2 ring-brand-green' : ''}
            `}
            onClick={() => handleOptionSelect(option.id)}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-grad-primary flex items-center justify-center">
                <div className="text-white">{option.icon}</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-ink-1">{option.title}</h3>
                  {option.recommended && (
                    <span className="status-pill text-brand-green">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-2 mt-1">{option.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-ink-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
      </div>
      
      <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
        <Button variant="outline" onClick={onClose} className="btn-ghost">
          I'll explore on my own
        </Button>
        <Button onClick={() => handleOptionSelect('dashboard')} className="btn-primary">
          Take me to dashboard
        </Button>
      </div>
    </Modal>
  );
};