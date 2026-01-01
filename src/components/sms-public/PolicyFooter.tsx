import { Link } from 'react-router-dom';
import { SMS_BRAND_CONFIG } from '@/config/smsConfig';

export const PolicyFooter = () => {
  return (
    <section className="py-8 px-6 border-t border-border">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-sm text-muted-foreground mb-4">
          Msg and Data rates may apply. Message frequency: {SMS_BRAND_CONFIG.message_frequency_text}.
        </p>
        
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link 
            to="/terms" 
            className="text-primary hover:text-primary/80 underline transition-colors"
          >
            Terms of Service
          </Link>
          <span className="text-muted-foreground">|</span>
          <Link 
            to="/privacy" 
            className="text-primary hover:text-primary/80 underline transition-colors"
          >
            Privacy Policy
          </Link>
          <span className="text-muted-foreground">|</span>
          <Link 
            to="/contact" 
            className="text-primary hover:text-primary/80 underline transition-colors"
          >
            Contact Us
          </Link>
        </div>
        
        <p className="text-xs text-muted-foreground mt-4">
          Reply HELP for help, STOP to cancel at any time.
        </p>
      </div>
    </section>
  );
};
