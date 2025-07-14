import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { useCanvaAuth } from '@/hooks/useCanvaAuth';
import { useUserRole } from '@/hooks/useUserRole';
// Removed sonner import - using global toast replacement
import { supabase } from '@/integrations/supabase/client';

interface CanvaEditorProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  contentTaskId: string;
  brandColors?: string[];
  logoUrl?: string;
  titleText?: string;
  designId?: string;
  onDesignComplete: (imageUrl: string) => void;
}

export const CanvaEditor: React.FC<CanvaEditorProps> = ({
  isOpen,
  onClose,
  imageUrl,
  contentTaskId,
  brandColors = ['#22C55E', '#1E40AF', '#8B5CF6', '#64748B'],
  logoUrl,
  titleText = 'Custom Design',
  designId,
  onDesignComplete
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, initiateOAuth, token } = useCanvaAuth();
  const { canUseCanva } = useUserRole();

  // Handle responsive sizing
  const iframeHeight = window.innerWidth <= 768 ? 400 : 600;

  useEffect(() => {
    if (isOpen && canUseCanva) {
      if (!isAuthenticated) {
        handleAuthFlow();
      } else {
        initializeCanvaEditor();
      }
    }
  }, [isOpen, isAuthenticated, canUseCanva]);

  const handleAuthFlow = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await initiateOAuth();
    } catch (err) {
      console.error('[CANVA_EDITOR] Auth error:', err);
      setError('Failed to authenticate with Canva. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeCanvaEditor = () => {
    if (!iframeRef.current) return;

    setIsLoading(true);
    setError(null);

    // Build Canva iframe URL with parameters
    const params = new URLSearchParams({
      templateImageUrl: imageUrl,
      brandColors: JSON.stringify(brandColors),
      titleText: titleText,
      accessToken: token || '',
      ...(logoUrl && { logoImageUrl: logoUrl }),
      ...(designId && { designId: designId })
    });

    // Mock Canva editor URL - in production this would be the actual Canva API endpoint
    const canvaUrl = `https://www.canva.com/api/design/embed?${params.toString()}`;
    
    // For demo purposes, we'll use a placeholder iframe
    // In production, this would load the actual Canva Button SDK
    const mockCanvaHtml = `
      <html>
        <head>
          <title>Canva Design Editor</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif; 
              background: #f5f5f5;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .editor-placeholder {
              background: white;
              border-radius: 8px;
              padding: 40px;
              text-align: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            .btn {
              background: #00c4cc;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 16px;
              margin: 10px;
            }
            .btn:hover { background: #00a8b0; }
            .preview-img {
              max-width: 200px;
              height: auto;
              border-radius: 6px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="editor-placeholder">
            <h3>Canva Design Editor (Development Preview)</h3>
            <p>Editing: ${titleText}</p>
            <p style="color: #666; font-size: 12px; margin: 10px 0;">⚠️ This is a development preview. Real Canva integration requires API setup.</p>
            <img src="${imageUrl}" alt="Design template" class="preview-img" />
            <div>
              <button class="btn" onclick="saveDesign()">Save Design</button>
              <button class="btn" onclick="cancelEdit()" style="background: #6b7280;">Cancel</button>
            </div>
          </div>
          
          <script>
            function saveDesign() {
              // Simulate design completion
              const designData = {
                exportUrl: '${imageUrl}',
                designId: 'design_${Date.now()}',
                title: '${titleText}'
              };
              
              window.parent.postMessage({
                type: 'CANVA_DESIGN_COMPLETE',
                data: designData
              }, '*');
            }
            
            function cancelEdit() {
              window.parent.postMessage({
                type: 'CANVA_EDITOR_CLOSE'
              }, '*');
            }
          </script>
        </body>
      </html>
    `;

    const blob = new Blob([mockCanvaHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    iframeRef.current.src = blobUrl;

    // Set timeout for loading
    const loadTimeout = setTimeout(() => {
      setError('Canva editor failed to load. Please check your network or try again.');
      setIsLoading(false);
    }, 10000);

    const handleLoad = () => {
      clearTimeout(loadTimeout);
      setIsLoading(false);
    };

    iframeRef.current.addEventListener('load', handleLoad);

    // Listen for messages from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'CANVA_DESIGN_COMPLETE') {
        handleDesignComplete(event.data.data);
      } else if (event.data.type === 'CANVA_EDITOR_CLOSE') {
        onClose();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearTimeout(loadTimeout);
      window.removeEventListener('message', handleMessage);
      if (iframeRef.current) {
        iframeRef.current.removeEventListener('load', handleLoad);
      }
    };
  };

  const handleDesignComplete = async (designData: any) => {
    setIsLoading(true);
    
    try {
      console.log('[CANVA_EDITOR] Design completed:', designData);

      // Upload the design to our media endpoint
      const response = await supabase.functions.invoke('media-upload', {
        body: {
          fileUrl: designData.exportUrl,
          contentTaskId,
          canvaDesignId: designData.designId
        }
      });

      if (response.error) {
        throw response.error;
      }

      const { imageUrl: newImageUrl } = response.data;
      
      // Update UI immediately
      onDesignComplete(newImageUrl);
      
      toast.success('Canva design saved and updated');
      onClose();

    } catch (error) {
      console.error('[CANVA_EDITOR] Save error:', error);
      
      // Retry logic with exponential backoff
      let retryCount = 0;
      const maxRetries = 2;
      
      const retryUpload = async () => {
        if (retryCount >= maxRetries) {
          toast.error('Unable to save design. Please try again later.');
          return;
        }
        
        retryCount++;
        const delay = retryCount === 1 ? 500 : 1000;
        
        setTimeout(async () => {
          try {
            const retryResponse = await supabase.functions.invoke('media-upload', {
              body: {
                fileUrl: designData.exportUrl,
                contentTaskId,
                canvaDesignId: designData.designId
              }
            });
            
            if (retryResponse.error) throw retryResponse.error;
            
            const { imageUrl: newImageUrl } = retryResponse.data;
            onDesignComplete(newImageUrl);
            toast.success('Canva design saved and updated');
            onClose();
            
          } catch (retryError) {
            console.error(`[CANVA_EDITOR] Retry ${retryCount} failed:`, retryError);
            retryUpload();
          }
        }, delay);
      };
      
      retryUpload();
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  if (!canUseCanva) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Access Restricted</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-gray-600 mb-4">
            Contact your admin to customize images with Canva.
          </p>
          <Button onClick={onClose} className="w-full">
            OK
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Design in Canva</h3>
            <p className="text-sm text-gray-500">Development Preview - Mock Integration</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-600">Loading Canva editor...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
              <div className="text-center max-w-md px-4">
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={() => initializeCanvaEditor()}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            id="canva-editor-iframe-container"
            className="w-full h-full border-0"
            style={{ height: `${iframeHeight}px` }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
};