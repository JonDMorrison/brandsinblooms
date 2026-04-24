import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Sparkles, PartyPopper, ArrowRight, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui-legacy/button';
import { useNavigate } from 'react-router-dom';

interface TourCelebrationProps {
  isVisible: boolean;
  onClose: () => void;
}

const confettiColors = [
  '#22C55E', // primary green
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#EC4899', // pink
  '#8B5CF6', // purple
  '#14B8A6', // teal
];

export function TourCelebration({ isVisible, onClose }: TourCelebrationProps) {
  const navigate = useNavigate();
  const [confettiPieces, setConfettiPieces] = useState<Array<{
    id: number;
    x: number;
    color: string;
    delay: number;
    size: number;
    rotation: number;
  }>>([]);

  useEffect(() => {
    if (isVisible) {
      // Generate confetti pieces
      const pieces = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        delay: Math.random() * 0.5,
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
      }));
      setConfettiPieces(pieces);

      // Auto-close after animation
      const timer = setTimeout(() => {
        onClose();
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  const handleGoToDashboard = () => {
    onClose();
    navigate('/dashboard');
  };

  const handleGoToSetup = () => {
    onClose();
    navigate('/account-setup');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100002] flex items-center justify-center bg-black/70 backdrop-blur-md"
        >
          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confettiPieces.map((piece) => (
              <motion.div
                key={piece.id}
                initial={{ 
                  y: -20, 
                  x: `${piece.x}vw`,
                  rotate: piece.rotation,
                  opacity: 1 
                }}
                animate={{ 
                  y: '110vh',
                  rotate: piece.rotation + 720,
                  opacity: 0 
                }}
                transition={{ 
                  duration: 3,
                  delay: piece.delay,
                  ease: 'easeIn'
                }}
                style={{
                  position: 'absolute',
                  width: piece.size,
                  height: piece.size,
                  backgroundColor: piece.color,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                }}
              />
            ))}
          </div>

          {/* Celebration card */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300, delay: 0.2 }}
            className="relative bg-background rounded-3xl shadow-2xl p-8 max-w-md mx-4 text-center"
          >
            {/* Animated icons */}
            <div className="relative mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full"
              >
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </motion.div>
              
              {/* Floating decorations */}
              <motion.div
                initial={{ scale: 0, x: 40, y: -20 }}
                animate={{ scale: 1, x: 50, y: -30 }}
                transition={{ delay: 0.6, type: 'spring' }}
                className="absolute top-0 right-1/4"
              >
                <Sparkles className="w-6 h-6 text-amber-500" />
              </motion.div>
              <motion.div
                initial={{ scale: 0, x: -40, y: 20 }}
                animate={{ scale: 1, x: -50, y: 10 }}
                transition={{ delay: 0.7, type: 'spring' }}
                className="absolute bottom-0 left-1/4"
              >
                <PartyPopper className="w-6 h-6 text-pink-500" />
              </motion.div>
            </div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-bold text-foreground mb-2"
            >
              You're All Set! 🎉
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-muted-foreground mb-8"
            >
              You've completed the product tour. Now you're ready to grow your garden center business!
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-col gap-3"
            >
              <Button onClick={handleGoToDashboard} size="lg" className="w-full">
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button onClick={handleGoToSetup} variant="outline" size="lg" className="w-full">
                <ListChecks className="w-4 h-4 mr-2" />
                Complete Account Setup
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-xs text-muted-foreground mt-4"
            >
              Tip: Check Account Setup to unlock all features
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
