import React from 'react';
import { 
  Mail, 
  MailCheck,
  Megaphone, 
  Calendar, 
  BarChart3, 
  Share2,
  Globe,
  Sparkles,
  CheckCircle,
  Clock,
  AlertCircle,
  Users
} from "lucide-react";

// Newsletter Icons
export const NewsletterIcon = ({ status }: { status?: string }) => {
  switch (status) {
    case 'connected':
    case 'active':
      return (
        <div className="relative">
          <MailCheck className="w-6 h-6 text-blue-600" />
          <CheckCircle className="w-3 h-3 absolute -top-1 -right-1 text-green-500 bg-white rounded-full" />
        </div>
      );
    default:
      return <Mail className="w-6 h-6 text-blue-600" />;
  }
};

// Campaign Icons with progress indicator
export const CampaignIcon = ({ status }: { status?: string }) => {
  if (status === 'pending') {
    return (
      <div className="relative">
        <Megaphone className="w-6 h-6 text-green-600" />
        <div className="absolute inset-0 w-8 h-8 -m-1">
          <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24">
            <circle 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="2" 
              fill="none" 
              strokeDasharray="31.416" 
              strokeDashoffset="15.708"
              className="text-green-400"
            />
          </svg>
        </div>
      </div>
    );
  }
  
  if (status === 'connected') {
    return (
      <div className="relative">
        <Megaphone className="w-6 h-6 text-green-600" />
        <CheckCircle className="w-3 h-3 absolute -top-1 -right-1 text-green-500 bg-white rounded-full" />
      </div>
    );
  }
  
  return <Megaphone className="w-6 h-6 text-green-600" />;
};

// Social Media Icons with connection status
export const SocialIcon = ({ status, connectionCount = 0 }: { status?: string; connectionCount?: number }) => {
  if (status === 'connected' && connectionCount > 0) {
    return (
      <div className="relative">
        <Share2 className="w-6 h-6" style={{ color: 'hsl(var(--brand-teal))' }} />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-xs text-white font-bold">{connectionCount}</span>
        </div>
      </div>
    );
  }
  
  if (status === 'setup-needed') {
    return (
      <div className="relative">
        <Share2 className="w-6 h-6 text-gray-400 stroke-dasharray-[2,2]" style={{ strokeDasharray: '2,2' }} />
        <AlertCircle className="w-3 h-3 absolute -top-1 -right-1 text-amber-500 bg-white rounded-full" />
      </div>
    );
  }
  
  return <Share2 className="w-6 h-6" style={{ color: 'hsl(var(--brand-teal))' }} />;
};

// Analytics Icons with animation
export const AnalyticsIcon = ({ status }: { status?: string }) => {
  return (
    <div className="relative group">
      <BarChart3 className="w-6 h-6" style={{ color: 'hsl(var(--brand-navy))' }} />
      {status === 'active' && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-1 h-1 bg-green-400 rounded-full absolute top-1 right-2 animate-ping" />
        </div>
      )}
    </div>
  );
};

// Calendar Icons
export const CalendarIcon = ({ status }: { status?: string }) => {
  return (
    <div className="relative">
      <Calendar className="w-6 h-6 text-orange-600" />
      {status === 'pending' && (
        <Clock className="w-3 h-3 absolute -top-1 -right-1 text-amber-500 bg-white rounded-full" />
      )}
    </div>
  );
};

// Create/Sparkles Icons
export const CreateIcon = ({ status }: { status?: string }) => {
  return (
    <div className="relative">
      <Sparkles className="w-6 h-6 text-indigo-600" />
      {status === 'active' && (
        <div className="absolute inset-0">
          <Sparkles className="w-6 h-6 text-indigo-600 animate-pulse" />
        </div>
      )}
    </div>
  );
};

// Website Icons
export const WebsiteIcon = ({ status }: { status?: string }) => {
  return (
    <div className="relative">
      <Globe className="w-6 h-6 text-teal-600" />
      {status === 'setup-needed' && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
          <span className="text-xs text-white">!</span>
        </div>
      )}
    </div>
  );
};

// Map card types to their dynamic icons
export const getDynamicIcon = (cardId: string, status?: string, connectionCount?: number) => {
  switch (cardId) {
    case 'newsletter':
      return <NewsletterIcon status={status} />;
    case 'campaign':
      return <CampaignIcon status={status} />;
    case 'social':
      return <SocialIcon status={status} connectionCount={connectionCount} />;
    case 'analytics':
      return <AnalyticsIcon status={status} />;
    case 'calendar':
      return <CalendarIcon status={status} />;
    case 'create-flow':
      return <CreateIcon status={status} />;
    case 'website':
      return <WebsiteIcon status={status} />;
    default:
      return null;
  }
};