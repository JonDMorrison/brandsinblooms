import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Sparkles, PartyPopper } from 'lucide-react';

interface SetupCelebrationProps {
  trigger: boolean;
  stepName: string;
  onComplete?: () => void;
}

const confettiColors = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)', // green
  'hsl(217, 91%, 60%)', // blue
  'hsl(45, 93%, 47%)', // gold
  'hsl(280, 87%, 65%)', // purple
  'hsl(340, 82%, 52%)', // pink
];

export const SetupCelebration: React.FC<SetupCelebrationProps> = ({
  trigger,
  stepName,
  onComplete,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<Array<{
    id: number;
    x: number;
    y: number;
    rotation: number;
    color: string;
    delay: number;
    size: number;
  }>>([]);

  useEffect(() => {
    if (trigger) {
      setIsActive(true);
      
      // Generate confetti pieces
      const pieces = Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        rotation: Math.random() * 360,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        delay: Math.random() * 0.5,
        size: 8 + Math.random() * 8,
      }));
      setConfettiPieces(pieces);

      const timer = setTimeout(() => {
        setIsActive(false);
        setConfettiPieces([]);
        onComplete?.();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {/* Confetti pieces */}
        {confettiPieces.map((piece) => (
          <motion.div
            key={piece.id}
            className="absolute rounded-sm"
            style={{
              left: `${piece.x}%`,
              width: piece.size,
              height: piece.size * 0.6,
              backgroundColor: piece.color,
            }}
            initial={{ 
              y: `${piece.y}vh`, 
              rotate: piece.rotation,
              opacity: 1,
            }}
            animate={{ 
              y: '120vh', 
              rotate: piece.rotation + 720,
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: piece.delay,
              ease: 'linear',
            }}
          />
        ))}

        {/* Center celebration message */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.5, type: 'spring' }}
        >
          <div className="bg-background/95 backdrop-blur-sm border-2 border-primary/20 rounded-2xl p-8 shadow-2xl max-w-md mx-4">
            <div className="flex justify-center mb-4">
              <motion.div
                className="relative"
                animate={{ 
                  rotate: [0, -10, 10, -10, 10, 0],
                }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="p-4 bg-gradient-to-br from-primary to-primary/80 rounded-full">
                  <CheckCircle2 className="w-12 h-12 text-primary-foreground" />
                </div>
                <motion.div
                  className="absolute -top-2 -right-2"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 15, -15, 0],
                  }}
                  transition={{ duration: 0.6, delay: 0.5, repeat: 2 }}
                >
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                </motion.div>
                <motion.div
                  className="absolute -bottom-1 -left-2"
                  animate={{ 
                    scale: [1, 1.3, 1],
                  }}
                  transition={{ duration: 0.4, delay: 0.7, repeat: 2 }}
                >
                  <PartyPopper className="w-5 h-5 text-pink-500" />
                </motion.div>
              </motion.div>
            </div>
            
            <motion.h2
              className="text-2xl font-bold text-center bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              🎉 Awesome!
            </motion.h2>
            
            <motion.p
              className="text-center text-muted-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="font-semibold text-foreground">{stepName}</span> is complete!
            </motion.p>
            
            <motion.p
              className="text-center text-sm text-muted-foreground mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Keep going, you're doing great! 🌱
            </motion.p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
