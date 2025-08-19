import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    color: 'from-slate-50 to-slate-100'
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            Getting Started with BloomSuite
          </DialogTitle>
          <p className="text-gray-600">
            Choose what you'd like to do first. You can always access these features from your dashboard.
          </p>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {quickStartOptions.map((option) => (
            <Card 
              key={option.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md border ${
                selectedOption === option.id ? 'ring-2 ring-blue-500' : 'hover:border-gray-300'
              } bg-gradient-to-br ${option.color}`}
              onClick={() => handleOptionSelect(option.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/50 rounded-lg">
                    {option.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{option.title}</h3>
                      {option.recommended && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{option.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <Button variant="ghost" onClick={onClose}>
            I'll explore on my own
          </Button>
          <Button onClick={() => handleOptionSelect('dashboard')}>
            Take me to dashboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};