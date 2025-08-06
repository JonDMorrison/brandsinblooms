import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  HelpCircle, 
  BookOpen, 
  MessageCircle, 
  Mail, 
  ExternalLink,
  FileText,
  Video,
  Users
} from 'lucide-react';

export const SupportSettings = () => {
  const supportResources = [
    {
      title: 'Help Center',
      description: 'Browse our comprehensive knowledge base and tutorials',
      icon: <BookOpen className="h-6 w-6 text-blue-600" />,
      action: 'Browse Articles',
      url: '#',
      badge: 'Popular'
    },
    {
      title: 'Video Tutorials',
      description: 'Watch step-by-step video guides for getting started',
      icon: <Video className="h-6 w-6 text-purple-600" />,
      action: 'Watch Videos',
      url: '#',
      badge: null
    },
    {
      title: 'API Documentation',
      description: 'Technical documentation for developers and integrations',
      icon: <FileText className="h-6 w-6 text-green-600" />,
      action: 'View Docs',
      url: '#',
      badge: null
    },
    {
      title: 'Community Forum',
      description: 'Connect with other users and share best practices',
      icon: <Users className="h-6 w-6 text-orange-600" />,
      action: 'Join Community',
      url: '#',
      badge: 'New'
    }
  ];

  const contactOptions = [
    {
      title: 'Email Support',
      description: 'Get help via email - we typically respond within 24 hours',
      icon: <Mail className="h-5 w-5 text-blue-600" />,
      action: 'Send Email',
      contact: 'support@bloomsuite.com'
    },
    {
      title: 'Live Chat',
      description: 'Chat with our support team during business hours',
      icon: <MessageCircle className="h-5 w-5 text-green-600" />,
      action: 'Start Chat',
      contact: 'Available 9 AM - 5 PM EST'
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Support & Help
          </CardTitle>
          <CardDescription>
            Access documentation, tutorials, and get help from our support team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Help Resources */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Help Resources</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {supportResources.map((resource) => (
                <Card key={resource.title} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {resource.icon}
                        <div>
                          <div className="font-medium">{resource.title}</div>
                          {resource.badge && (
                            <Badge variant="secondary" className="mt-1">
                              {resource.badge}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {resource.description}
                    </p>
                    <Button size="sm" variant="outline" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {resource.action}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Contact Support */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact Support</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contactOptions.map((option) => (
                <Card key={option.title} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {option.icon}
                      <div className="font-medium">{option.title}</div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {option.description}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {option.contact}
                    </p>
                    <Button size="sm" className="w-full">
                      {option.action}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* System Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">System Information</h3>
            
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <span className="ml-2 font-mono">v1.0.0</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Environment:</span>
                    <span className="ml-2">Production</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Browser:</span>
                    <span className="ml-2">{navigator.userAgent.split(' ')[0]}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">User ID:</span>
                    <span className="ml-2 font-mono text-xs">••••••••</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  This information helps our support team assist you more effectively.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feature Requests */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Feedback & Feature Requests</h3>
            
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <MessageCircle className="h-5 w-5 text-blue-600" />
                  <div className="font-medium">We'd Love Your Feedback!</div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Help us improve BloomSuite by sharing your ideas and suggestions.
                </p>
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Submit Feedback
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};