
import { Button } from "@/components/ui/button";
import { Instagram, Facebook, Mail, BookOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface QuickCopyActionsProps {
  content: string;
}

export const QuickCopyActions = ({ content }: QuickCopyActionsProps) => {
  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `Content copied for ${platform}`,
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-gray-800">Quick Copy Actions</h3>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => copyToClipboard(content, "Instagram")}
        disabled={!content.trim()}
      >
        <Instagram className="w-4 h-4 mr-2" />
        Copy for Instagram
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => copyToClipboard(content, "Facebook")}
        disabled={!content.trim()}
      >
        <Facebook className="w-4 h-4 mr-2" />
        Copy for Facebook
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => copyToClipboard(content, "Email")}
        disabled={!content.trim()}
      >
        <Mail className="w-4 h-4 mr-2" />
        Copy for Email
      </Button>

      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => copyToClipboard(content, "Newsletter")}
        disabled={!content.trim()}
      >
        <BookOpen className="w-4 h-4 mr-2" />
        Copy for Newsletter
      </Button>
    </div>
  );
};
