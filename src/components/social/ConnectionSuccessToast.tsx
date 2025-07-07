import React from 'react';
import { Facebook, Instagram, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CelebrationConfetti } from '../ui/celebration-confetti';

interface ConnectionSuccessData {
  message: string;
  platforms: string[];
  timestamp: number;
}

export const showConnectionSuccessToast = (data: ConnectionSuccessData) => {
  const platformIcons = {
    facebook: <Facebook className="w-4 h-4 text-blue-600" />,
    instagram: <Instagram className="w-4 h-4 text-purple-600" />
  };

  // Add confetti element to DOM temporarily
  const confettiContainer = document.createElement('div');
  document.body.appendChild(confettiContainer);
  
  // Simple confetti effect
  setTimeout(() => {
    document.body.removeChild(confettiContainer);
  }, 3000);

  toast.success(
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
        <CheckCircle className="w-5 h-5 text-green-600" />
      </div>
      <div className="space-y-2">
        <p className="font-semibold text-green-800">{data.message}</p>
        {data.platforms && data.platforms.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Connected:</span>
            <div className="flex gap-1">
              {data.platforms.map((platform) => (
                <div key={platform} className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-md">
                  {platformIcons[platform as keyof typeof platformIcons]}
                  <span className="text-xs font-medium capitalize">{platform}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    {
      duration: 6000,
      className: 'bg-green-50 border-green-200',
    }
  );
};