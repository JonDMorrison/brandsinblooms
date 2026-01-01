import { Link } from 'react-router-dom';
import { SMS_BRAND_CONFIG } from '@/config/smsConfig';

export const PublicFooter = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-muted/50 border-t border-border py-8 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Copyright */}
          <div className="text-sm text-muted-foreground">
            © {currentYear} {SMS_BRAND_CONFIG.legal_name}. All rights reserved.
          </div>
          
          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            <Link 
              to="/sms-program" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              SMS Program
            </Link>
            <Link 
              to="/terms" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <Link 
              to="/privacy" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link 
              to="/contact" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </Link>
          </nav>
        </div>
        
        {/* Support email */}
        <div className="mt-4 text-center md:text-right">
          <a 
            href={`mailto:${SMS_BRAND_CONFIG.support_email}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {SMS_BRAND_CONFIG.support_email}
          </a>
        </div>
      </div>
    </footer>
  );
};
