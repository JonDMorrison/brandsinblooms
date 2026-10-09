
import { Button } from "@/components/ui-legacy/button";
import { Menu, X, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SUITE_PRODUCTS } from "@/components/suite/products";
import "@/components/suite/suiteMarketing.css";
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
    { name: "Features", href: "/features" },
    { name: "Build your suite", href: "/build-your-suite" },
    { name: "CRM pricing", href: "/pricing" },
    { name: "FAQ", href: "/faq" },
    { name: "Contact", href: "/contact" },
  ];

  useEffect(() => { setMobileMenuOpen(false); document.querySelectorAll<HTMLDetailsElement>("details.suite-products-menu").forEach(menu => { menu.open = false; }); }, [location.pathname]);

  const productsMenu = <details className="suite-products-menu" onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}><summary>Products <ChevronDown size={16} aria-hidden="true" /></summary><div className="suite-products-menu-panel">{SUITE_PRODUCTS.map(product => product.href.startsWith("https:") ? <a key={product.id} href={product.href}><strong>{product.name}</strong><span>{product.category}</span></a> : <Link key={product.id} to={product.href}><strong>{product.name}</strong><span>{product.category}</span></Link>)}</div></details>;

  const isActiveRoute = (href: string) => {
    if (href === "/" && location.pathname === "/") return true;
    if (href !== "/" && location.pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <nav className={`flex items-center px-4 py-3 sticky top-0 z-50 bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-lg shadow-black/10' : ''}`}>
      {/* Logo */}
      <div className="flex items-center">
        <Link to="/" className="flex items-center gap-2 text-xl md:text-2xl font-bold text-black hover:text-black/80 transition-colors">
          <img src={bloomsuiteLogo} alt="BloomSuite Logo" className="h-7 w-7" />
          BloomSuite
        </Link>
      </div>

      {/* Navigation Links - Right after logo */}
      <div className="hidden xl:flex items-center gap-4 ml-6">
        {productsMenu}
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={`text-sm font-medium whitespace-nowrap transition-colors hover:text-primary ${
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
      <div className="hidden xl:flex items-center gap-2 ml-auto">
        {user && showUserMenu && (
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
        )}
        
        <Button 
          onClick={onLogin}
          variant="outline"
          size="sm"
          className="border-[#3E7C77] text-[#3E7C77] hover:bg-[#3E7C77]/10"
        >
          Log In
        </Button>
        <Button 
          variant="ghost"
          onClick={onLogin}
          size="sm"
          className="bg-[#3E7C77] hover:bg-[#2E605C] text-white"
        >
          Sign Up
        </Button>
      </div>

      {/* Mobile Menu Button */}
      <div className="xl:hidden flex items-center gap-4 ml-auto">
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
          aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileMenuOpen}
          aria-controls="suite-mobile-navigation"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-foreground"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div id="suite-mobile-navigation" className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg xl:hidden [&_.suite-products-menu-panel]:static [&_.suite-products-menu-panel]:shadow-none">
          <div className="flex flex-col p-6 space-y-4">
            {productsMenu}
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
                variant="outline"
                className="justify-start border-[#3E7C77] text-[#3E7C77] hover:bg-[#3E7C77]/10"
              >
                Log In
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  onLogin();
                  setMobileMenuOpen(false);
                }}
                className="bg-[#3E7C77] hover:bg-[#2E605C] text-white"
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


