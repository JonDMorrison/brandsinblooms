import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Eye, Clock, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { NewsletterRegenerator } from "@/components/content-sidebar/newsletter/NewsletterRegenerator";
import { checkIsPlaceholderContent } from "@/components/content-sidebar/newsletter/NewsletterHelpers";

interface NewsletterPreviewCardProps {
  newsletter: {
    id: string;
    ai_output: string;
    campaign_id: string;
    status: string;
  };
  campaignTitle: string;
  onUpdate?: () => void;
}

export const NewsletterPreviewCard = ({ 
  newsletter, 
  campaignTitle,
  onUpdate 
}: NewsletterPreviewCardProps) => {
  const navigate = useNavigate();
  const [regenerating, setRegenerating] = useState(false);
  
  // Extract newsletter data from YAML content
  const extractNewsletterData = (content: string) => {
    try {
      // Try to parse YAML to get newsletter content
      const yamlMatch = content.match(/newsletter_md:\s*\|\s*([\s\S]*?)(?=\n\w+:|\nblocks:|$)/);
      if (yamlMatch) {
        const newsletterContent = yamlMatch[1];
        const titleMatch = newsletterContent.match(/^#\s*(.*)/m);
        const previewMatch = newsletterContent.match(/\*([^*]+)\*/);
        
        return {
          title: titleMatch ? titleMatch[1] : campaignTitle,
          preview: previewMatch ? previewMatch[1] : 'Expert gardening insights and seasonal tips',
          readingTime: '≈3 min'
        };
      }
      
      // Fallback for non-YAML content
      const lines = content.split('\n').filter(line => line.trim());
      const title = lines.find(line => line.startsWith('#'))?.replace('#', '').trim() || campaignTitle;
      const preview = lines.find(line => line.includes('*') && line.length > 20)?.replace(/\*/g, '').trim() || 'Professional garden center newsletter';
      
      return {
        title,
        preview: preview.substring(0, 80) + '...',
        readingTime: '≈3 min'
      };
    } catch (error) {
      return {
        title: campaignTitle,
        preview: 'Professional garden center newsletter',
        readingTime: '≈3 min'
      };
    }
  };

  const isPlaceholder = checkIsPlaceholderContent(newsletter.ai_output);
  const newsletterData = extractNewsletterData(newsletter.ai_output);

  const handleViewNewsletter = () => {
    navigate(`/calendar?campaign=${newsletter.campaign_id}&task=${newsletter.id}`);
  };

  const handleUseCRM = () => {
    navigate(`/crm/campaigns/new?newsletter=${newsletter.id}&theme=${campaignTitle}`);
  };

  if (isPlaceholder) {
    return (
      <Card className="w-full border-orange-200 bg-orange-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-orange-600" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-900">Newsletter Needs Attention</h3>
              <p className="text-sm text-orange-700 mt-1">
                The newsletter content appears to be placeholder text
              </p>
            </div>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              Regenerate Needed
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-2">
            <NewsletterRegenerator
              contentTaskId={newsletter.id}
              campaignTitle={campaignTitle}
              regenerating={regenerating}
              setRegenerating={setRegenerating}
            />
            <Button 
              onClick={handleViewNewsletter}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              View Content
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-teal-200 bg-teal-50/50 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-teal-100">
            <Mail className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-teal-900 truncate">
              {newsletterData.title}
            </h3>
            <p className="text-sm text-teal-700 mt-1 line-clamp-2">
              {newsletterData.preview}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-teal-600" />
                <span className="text-xs text-teal-600">{newsletterData.readingTime}</span>
              </div>
              <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                Newsletter Ready
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleUseCRM}
            variant="default"
            size="sm"
            className="gap-2 bg-teal-600 hover:bg-teal-700"
          >
            <Mail className="w-4 h-4" />
            Use in CRM
          </Button>
          <Button 
            onClick={handleViewNewsletter}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            Review Content
          </Button>
          <NewsletterRegenerator
            contentTaskId={newsletter.id}
            campaignTitle={campaignTitle}
            regenerating={regenerating}
            setRegenerating={setRegenerating}
          />
        </div>
      </CardContent>
    </Card>
  );
};