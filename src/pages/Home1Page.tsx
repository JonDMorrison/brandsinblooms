import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPageHeader } from '@/components/landing/LandingPageHeader';

export const Home1Page = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/auth');
  };

  return (
    <div className="w-full min-h-screen theme-core-home bg-offwhite">
      <LandingPageHeader onLogin={handleLogin} />
      
      {/* Main content area with hello world message */}
      <main className="flex items-center justify-center py-20">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-accent mb-4">
            Hello World!
          </h1>
          <p className="text-xl text-muted-foreground">
            Welcome to the Home1 page
          </p>
        </div>
      </main>
    </div>
  );
};