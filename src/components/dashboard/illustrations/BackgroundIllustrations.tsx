import React from 'react';

// Newsletter illustration - envelope/paper stack
export const NewsletterIllustration = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 120 120" 
    className={`absolute bottom-0 right-0 w-32 h-32 ${className}`}
    style={{ opacity: 0.15 }}
  >
    <g fill="currentColor">
      {/* Paper stack */}
      <rect x="20" y="50" width="70" height="50" rx="4" transform="rotate(-5 55 75)" />
      <rect x="25" y="45" width="70" height="50" rx="4" transform="rotate(-2 60 70)" />
      <rect x="30" y="40" width="70" height="50" rx="4" />
      
      {/* Envelope */}
      <path d="M15 30 L105 30 L105 85 L15 85 Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M15 30 L60 65 L105 30" fill="none" stroke="currentColor" strokeWidth="2" />
    </g>
  </svg>
);

// Campaign illustration - flow chart/arrows
export const CampaignIllustration = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 120 120" 
    className={`absolute bottom-0 right-0 w-32 h-32 ${className}`}
    style={{ opacity: 0.15 }}
  >
    <g fill="currentColor" stroke="currentColor" strokeWidth="2">
      {/* Flow nodes */}
      <circle cx="30" cy="30" r="8" />
      <circle cx="70" cy="30" r="8" />
      <circle cx="50" cy="70" r="8" />
      <circle cx="90" cy="70" r="8" />
      
      {/* Connecting arrows */}
      <path d="M38 30 L62 30" fill="none" markerEnd="url(#arrowhead)" />
      <path d="M70 38 L50 62" fill="none" markerEnd="url(#arrowhead)" />
      <path d="M58 70 L82 70" fill="none" markerEnd="url(#arrowhead)" />
      
      {/* Arrow marker */}
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" 
         refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
        </marker>
      </defs>
    </g>
  </svg>
);

// Calendar illustration - small calendar grid
export const CalendarIllustration = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 120 120" 
    className={`absolute bottom-0 right-0 w-32 h-32 ${className}`}
    style={{ opacity: 0.15 }}
  >
    <g fill="currentColor">
      {/* Calendar frame */}
      <rect x="20" y="25" width="80" height="70" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
      
      {/* Calendar header */}
      <rect x="20" y="25" width="80" height="15" rx="6" />
      
      {/* Calendar grid */}
      <line x1="30" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="30" y1="65" x2="90" y2="65" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="30" y1="80" x2="90" y2="80" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      
      <line x1="40" y1="45" x2="40" y2="90" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="55" y1="45" x2="55" y2="90" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="70" y1="45" x2="70" y2="90" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      
      {/* Highlighted dates */}
      <circle cx="47" cy="57" r="3" />
      <circle cx="77" cy="72" r="3" />
    </g>
  </svg>
);

// Analytics illustration - upward arrow graph
export const AnalyticsIllustration = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 120 120" 
    className={`absolute bottom-0 right-0 w-32 h-32 ${className}`}
    style={{ opacity: 0.15 }}
  >
    <g fill="currentColor" stroke="currentColor" strokeWidth="2">
      {/* Chart bars */}
      <rect x="25" y="80" width="12" height="15" />
      <rect x="42" y="70" width="12" height="25" />
      <rect x="59" y="55" width="12" height="40" />
      <rect x="76" y="40" width="12" height="55" />
      
      {/* Upward arrow */}
      <path d="M95 25 L95 45" fill="none" markerEnd="url(#arrowup)" />
      <path d="M85 35 L95 25 L105 35" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      
      <defs>
        <marker id="arrowup" markerWidth="10" markerHeight="7" 
         refX="5" refY="1" orient="auto">
          <polygon points="0 7, 5 0, 10 7" fill="currentColor" />
        </marker>
      </defs>
    </g>
  </svg>
);

// Social Media illustration - connected nodes/share icon
export const SocialIllustration = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 120 120" 
    className={`absolute bottom-0 right-0 w-32 h-32 ${className}`}
    style={{ opacity: 0.15 }}
  >
    <g fill="currentColor" stroke="currentColor" strokeWidth="2">
      {/* Central node */}
      <circle cx="60" cy="60" r="12" />
      
      {/* Connected nodes */}
      <circle cx="30" cy="35" r="8" />
      <circle cx="90" cy="35" r="8" />
      <circle cx="30" cy="85" r="8" />
      <circle cx="90" cy="85" r="8" />
      
      {/* Connection lines */}
      <line x1="48" y1="52" x2="38" y2="43" />
      <line x1="72" y1="52" x2="82" y2="43" />
      <line x1="48" y1="68" x2="38" y2="77" />
      <line x1="72" y1="68" x2="82" y2="77" />
    </g>
  </svg>
);

// Create/Post illustration - pencil/quill
export const CreateIllustration = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 120 120" 
    className={`absolute bottom-0 right-0 w-32 h-32 ${className}`}
    style={{ opacity: 0.15 }}
  >
    <g fill="currentColor" stroke="currentColor" strokeWidth="2">
      {/* Pencil */}
      <path d="M25 95 L35 85 L85 35 L95 25 L105 35 L95 45 L45 95 L35 105 Z" fill="none" />
      <path d="M85 35 L95 45" />
      
      {/* Paper lines */}
      <line x1="15" y1="50" x2="50" y2="50" strokeWidth="1" opacity="0.6" />
      <line x1="15" y1="65" x2="45" y2="65" strokeWidth="1" opacity="0.6" />
      <line x1="15" y1="80" x2="40" y2="80" strokeWidth="1" opacity="0.6" />
      
      {/* Sparkles */}
      <circle cx="75" cy="25" r="2" />
      <circle cx="105" cy="55" r="1.5" />
      <circle cx="95" cy="75" r="1" />
    </g>
  </svg>
);

// Website illustration - globe/browser
export const WebsiteIllustration = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 120 120" 
    className={`absolute bottom-0 right-0 w-32 h-32 ${className}`}
    style={{ opacity: 0.15 }}
  >
    <g fill="currentColor" stroke="currentColor" strokeWidth="2">
      {/* Globe */}
      <circle cx="60" cy="60" r="35" fill="none" />
      
      {/* Grid lines */}
      <path d="M25 60 Q40 45 60 60 Q80 75 95 60" fill="none" />
      <path d="M25 60 Q40 75 60 60 Q80 45 95 60" fill="none" />
      <line x1="60" y1="25" x2="60" y2="95" />
      <ellipse cx="60" cy="60" rx="20" ry="35" fill="none" />
      
      {/* Browser window */}
      <rect x="40" y="15" width="50" height="35" rx="4" fill="none" />
      <line x1="40" y1="25" x2="90" y2="25" />
      <circle cx="45" cy="20" r="2" />
      <circle cx="52" cy="20" r="2" />
      <circle cx="59" cy="20" r="2" />
    </g>
  </svg>
);

// Map card types to their illustrations
export const getCardIllustration = (cardId: string) => {
  switch (cardId) {
    case 'newsletter':
      return NewsletterIllustration;
    case 'campaign':
      return CampaignIllustration;
    case 'calendar':
      return CalendarIllustration;
    case 'analytics':
      return AnalyticsIllustration;
    case 'social':
      return SocialIllustration;
    case 'create-flow':
      return CreateIllustration;
    case 'website':
      return WebsiteIllustration;
    default:
      return CreateIllustration;
  }
};