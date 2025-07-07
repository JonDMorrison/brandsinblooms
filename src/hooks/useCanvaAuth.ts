import { useState, useEffect } from 'react';

const CANVA_TOKEN_KEY = 'canvaAccessToken';
const CANVA_TOKEN_EXPIRY_KEY = 'canvaTokenExpiry';

interface CanvaAuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useCanvaAuth = () => {
  const [authState, setAuthState] = useState<CanvaAuthState>({
    token: null,
    isAuthenticated: false,
    isLoading: true
  });

  useEffect(() => {
    checkExistingToken();
  }, []);

  const checkExistingToken = () => {
    try {
      const token = localStorage.getItem(CANVA_TOKEN_KEY);
      const expiry = localStorage.getItem(CANVA_TOKEN_EXPIRY_KEY);

      if (token && expiry) {
        const expiryTime = parseInt(expiry);
        const now = Date.now();

        if (now < expiryTime) {
          setAuthState({
            token,
            isAuthenticated: true,
            isLoading: false
          });
          return;
        } else {
          // Token expired, clear it
          clearToken();
        }
      }

      setAuthState({
        token: null,
        isAuthenticated: false,
        isLoading: false
      });
    } catch (error) {
      console.error('[CANVA_AUTH] Error checking token:', error);
      setAuthState({
        token: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  };

  const storeToken = (token: string, expiresIn: number = 3600) => {
    try {
      const expiryTime = Date.now() + (expiresIn * 1000);
      
      localStorage.setItem(CANVA_TOKEN_KEY, token);
      localStorage.setItem(CANVA_TOKEN_EXPIRY_KEY, expiryTime.toString());

      setAuthState({
        token,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error) {
      console.error('[CANVA_AUTH] Error storing token:', error);
    }
  };

  const clearToken = () => {
    try {
      localStorage.removeItem(CANVA_TOKEN_KEY);
      localStorage.removeItem(CANVA_TOKEN_EXPIRY_KEY);

      setAuthState({
        token: null,
        isAuthenticated: false,
        isLoading: false
      });
    } catch (error) {
      console.error('[CANVA_AUTH] Error clearing token:', error);
    }
  };

  const initiateOAuth = async () => {
    // For now, simulate OAuth flow with a mock token
    // In production, this would redirect to Canva's OAuth endpoint
    console.log('[CANVA_AUTH] Initiating OAuth flow...');
    
    // Simulate OAuth success with mock token
    setTimeout(() => {
      const mockToken = `mock_canva_token_${Date.now()}`;
      storeToken(mockToken, 3600);
    }, 1000);
  };

  return {
    ...authState,
    storeToken,
    clearToken,
    initiateOAuth,
    refreshAuth: checkExistingToken
  };
};