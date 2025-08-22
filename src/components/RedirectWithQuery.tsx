import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface RedirectWithQueryProps {
  to: string;
}

export const RedirectWithQuery: React.FC<RedirectWithQueryProps> = ({ to }) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fullPath = `${to}${location.search}`;
    console.log('🔄 Redirecting with preserved query params:', fullPath);
    navigate(fullPath, { replace: true });
  }, [to, location.search, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-pulse text-muted-foreground">
          Redirecting...
        </div>
      </div>
    </div>
  );
};