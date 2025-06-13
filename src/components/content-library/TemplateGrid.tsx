
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Copy, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Template {
  id: string;
  title: string;
  category: string;
  description: string;
  content: string;
  variables: string[];
  type: string;
  tags: string[];
  created_at: string;
  usage_count: number;
}

interface TemplateGridProps {
  templates: Template[];
  loading: boolean;
  onUseTemplate: (template: Template) => void;
  onEditTemplate: (template: Template) => void;
  onDeleteTemplate: (templateId: string) => void;
}

export const TemplateGrid = ({ 
  templates, 
  loading,
  onUseTemplate, 
  onEditTemplate, 
  onDeleteTemplate 
}: TemplateGridProps) => {
  const getCategoryColor = (category: string) => {
    const colors = {
      'Educational': 'bg-green-100 text-green-800',
      'Promotional': 'bg-blue-100 text-blue-800',
      'Community': 'bg-purple-100 text-purple-800',
      'Seasonal': 'bg-orange-100 text-orange-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No templates found</p>
        <p className="text-gray-400">Try adjusting your search or create a new template</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <Card key={template.id} className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <CardTitle className="text-lg font-semibold line-clamp-1">
                  {template.title}
                </CardTitle>
                <CardDescription className="mt-1 line-clamp-2">
                  {template.description}
                </CardDescription>
              </div>
              <Badge className={getCategoryColor(template.category)}>
                {template.category}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Preview */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600 line-clamp-3">
                {template.content.substring(0, 150)}...
              </p>
            </div>

            {/* Variables */}
            {template.variables.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Variables ({template.variables.length}):
                </p>
                <div className="flex flex-wrap gap-1">
                  {template.variables.slice(0, 3).map((variable, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {variable}
                    </Badge>
                  ))}
                  {template.variables.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{template.variables.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {template.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Used {template.usage_count} times
              </span>
              <span>{new Date(template.created_at).toLocaleDateString()}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => onUseTemplate(template)}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Copy className="h-3 w-3 mr-1" />
                Use Template
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEditTemplate(template)}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDeleteTemplate(template.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
