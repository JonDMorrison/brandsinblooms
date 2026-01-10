import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, MapPin, Send, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuickTour } from '@/contexts/QuickTourContext';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';

interface TourWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Simple welcome animation data
const welcomeAnimation = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 60,
  w: 200,
  h: 200,
  nm: "Welcome",
  layers: [
    {
      ty: 4,
      nm: "Star",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { 
          a: 1, 
          k: [
            { t: 0, s: [0], e: [360] },
            { t: 60, s: [360] }
          ]
        },
        s: { 
          a: 1, 
          k: [
            { t: 0, s: [80, 80], e: [100, 100] },
            { t: 30, s: [100, 100], e: [80, 80] },
            { t: 60, s: [80, 80] }
          ]
        },
        p: { a: 0, k: [100, 100] }
      },
      shapes: [
        {
          ty: "sr",
          sy: 1,
          pt: { a: 0, k: 5 },
          p: { a: 0, k: [0, 0] },
          r: { a: 0, k: 0 },
          ir: { a: 0, k: 20 },
          or: { a: 0, k: 50 }
        },
        {
          ty: "fl",
          c: { a: 0, k: [0.133, 0.773, 0.369, 1] },
          o: { a: 0, k: 100 }
        }
      ]
    }
  ]
};

const pathOptions = [
  {
    id: 'quick',
    icon: Rocket,
    title: 'Quick Tour',
    subtitle: '60 seconds',
    description: 'Get a fast overview of all key features',
    color: 'bg-primary',
  },
  {
    id: 'setup',
    icon: MapPin,
    title: 'Setup Checklist',
    subtitle: 'Step by step',
    description: 'Configure your account at your own pace',
    color: 'bg-secondary',
  },
  {
    id: 'campaign',
    icon: Send,
    title: 'First Campaign',
    subtitle: '5 minutes',
    description: 'Jump straight to sending your first email',
    color: 'bg-accent',
  },
];

export function TourWelcomeModal({ isOpen, onClose }: TourWelcomeModalProps) {
  const { startTour, setTourPath } = useQuickTour();
  const navigate = useNavigate();

  const handlePathSelect = (pathId: string) => {
    switch (pathId) {
      case 'quick':
        setTourPath?.('quick');
        startTour();
        onClose();
        break;
      case 'setup':
        onClose();
        navigate('/account-setup');
        break;
      case 'campaign':
        setTourPath?.('campaign');
        startTour();
        onClose();
        navigate('/crm/campaigns');
        break;
    }
  };

  const handleSkip = () => {
    onClose();
    // Store that user has seen the welcome modal
    localStorage.setItem('tour-welcome-dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleSkip();
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-muted rounded-full z-10"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Header with animation */}
            <div className="relative pt-8 pb-4 px-6 text-center bg-gradient-to-b from-primary/10 to-transparent">
              <div className="w-24 h-24 mx-auto mb-4">
                <Lottie 
                  animationData={welcomeAnimation} 
                  loop={true}
                  autoplay={true}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Welcome to BloomSuite! 🌱
              </h2>
              <p className="text-muted-foreground">
                How would you like to get started?
              </p>
            </div>

            {/* Path options */}
            <div className="p-6 space-y-3">
              {pathOptions.map((option, index) => (
                <motion.button
                  key={option.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handlePathSelect(option.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 text-left group"
                >
                  <div className={`p-3 rounded-xl ${option.color} text-primary-foreground group-hover:scale-110 transition-transform`}>
                    <option.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{option.title}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {option.subtitle}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  </div>
                  <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </motion.button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 text-center">
              <button
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now — I'll explore on my own
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                You can always start the tour from the menu
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
