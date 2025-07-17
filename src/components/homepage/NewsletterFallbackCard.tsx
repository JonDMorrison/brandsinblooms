import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NewsletterFallbackCardProps {
  themeTitle: string;
  themeId: string;
}

export const NewsletterFallbackCard = ({ 
  themeTitle, 
  themeId 
}: NewsletterFallbackCardProps) => {
  const navigate = useNavigate();

  const handleCreateNewsletter = () => {
    navigate(`/crm/campaigns/new?theme=${themeId}&title=${encodeURIComponent(themeTitle)}`);
  };

  return (
    <Card className="w-full border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900">
              Create Newsletter
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              No newsletter generated for "{themeTitle}" yet
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Button 
          onClick={handleCreateNewsletter}
          variant="default"
          size="sm"
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Newsletter
        </Button>
      </CardContent>
    </Card>
  );
};