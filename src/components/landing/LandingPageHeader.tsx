
import { Button } from "@/components/ui/button";
import { LogIn, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import bloomsuiteLogo from "@/assets/bloomsuite-logo-correct.png";

interface LandingPageHeaderProps {
  onLogin: () => void;
  showUserMenu?: boolean;
}

export const LandingPageHeader = ({ onLogin, showUserMenu = true }: LandingPageHeaderProps) => {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Features", href: "/features" },
    { name: "Pricing", href: "/pricing" },
  ];

  const isActiveRoute = (href: string) => {
    if (href === "/" && location.pathname === "/") return true;
    if (href !== "/" && location.pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <nav className={`flex items-center px-6 py-4 sticky top-0 z-50 bg-background/80 backdrop-blur-md transition-shadow duration-300 ${isScrolled ? 'shadow-lg shadow-black/10' : ''}`}>
      {/* Logo */}
      <div className="flex items-center">
        <Link to="/" className="flex items-center gap-2 text-2xl font-bold text-black hover:text-black/80 transition-colors">
          <img src={bloomsuiteLogo} alt="BloomSuite Logo" className="h-8 w-8" />
          BloomSuite
        </Link>
      </div>

      {/* Navigation Links - Right after logo */}
      <div className="hidden md:flex items-center gap-8 ml-12">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={`text-sm font-medium transition-colors hover:text-primary ${
              isActiveRoute(item.href) 
                ? "text-primary border-b-2 border-primary pb-1" 
                : "text-muted-foreground"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </div>
        
      {/* Auth Buttons - Far right */}
      <div className="hidden md:flex items-center gap-3 ml-auto">
        {user && showUserMenu && (
          <Button 
            asChild
            variant="outline"
            className="text-foreground border-border hover:bg-accent"
          >
            <Link to="/dashboard">
              Your Account
            </Link>
          </Button>
        )}
        
        <Button 
          onClick={onLogin}
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
        >
          Sign In
        </Button>
        <Button 
          onClick={onLogin}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          Sign Up
        </Button>
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden flex items-center gap-4">
        {user && showUserMenu ? (
          <Button 
            asChild
            variant="outline"
            size="sm"
            className="text-foreground border-border hover:bg-accent"
          >
            <Link to="/dashboard">
              Your Account
            </Link>
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-foreground"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-background border-b border-border/50 shadow-lg md:hidden">
          <div className="flex flex-col p-6 space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActiveRoute(item.href) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.name}
              </Link>
            ))}
            
            {/* Auth buttons for mobile */}
            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <Button 
                onClick={() => {
                  onLogin();
                  setMobileMenuOpen(false);
                }}
                variant="ghost"
                className="justify-start text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => {
                  onLogin();
                  setMobileMenuOpen(false);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
