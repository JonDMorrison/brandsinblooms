
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Instagram, Facebook, Mail, BookOpen, Video } from "lucide-react";

interface ThemePreviewProps {
  theme: string;
  description?: string;
}

const contentTypes = [
  {
    id: 'instagram',
    name: 'Instagram Post',
    icon: Instagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 border-pink-200',
    preview: 'Engaging plant care tips with emojis and hashtags'
  },
  {
    id: 'facebook',
    name: 'Facebook Post',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    preview: 'Community-focused content with discussion questions'
  },
  {
    id: 'blog',
    name: 'Blog Post',
    icon: BookOpen,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    preview: 'Educational guide with structured headings and tips'
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    icon: Mail,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    preview: 'Weekly roundup with seasonal advice and updates'
  },
  {
    id: 'video',
    name: 'Video Script',
    icon: Video,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    preview: 'Step-by-step demonstration script for plant care'
  }
];

export const ThemePreview = ({ theme, description }: ThemePreviewProps) => {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-blue-900">Content Pack Preview</CardTitle>
        <p className="text-sm text-blue-700">
          This theme will generate 5 pieces of professional marketing content:
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {contentTypes.map((type) => {
          const IconComponent = type.icon;
          return (
            <div key={type.id} className={`p-3 rounded-lg border ${type.bgColor}`}>
              <div className="flex items-center gap-2 mb-1">
                <IconComponent className={`w-4 h-4 ${type.color}`} />
                <span className="font-medium text-gray-900">{type.name}</span>
                <Badge variant="outline" className="text-xs">
                  {theme.toLowerCase().includes('seasonal') ? 'Seasonal' : 'Business'}
                </Badge>
              </div>
              <p className="text-xs text-gray-600">{type.preview}</p>
            </div>
          );
        })}
        
        <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
          <p className="text-xs text-blue-600 font-medium">
            ℹ️ All content will require your approval before appearing in "Ready to Post"
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
