import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, HelpCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-green-600 mb-4">404</div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-gray-600 mb-8">
          The page you're looking for doesn't exist or the link may have expired.
          This can happen with password reset links and email confirmation links.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={() => navigate('/')} className="inline-flex items-center gap-2">
            <Home className="h-4 w-4" />
            Return Home
          </Button>
        </div>
        <div className="mt-6">
          <a
            href="/support"
            className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
          >
            <HelpCircle className="h-4 w-4" />
            Need help? Contact support
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
