import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NewsletterPicker } from '@/components/newsletter/NewsletterPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Mail, Sparkles } from 'lucide-react';

export const NewsletterNewPage: React.FC = () => {
  const [showPicker, setShowPicker] = useState(true);
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Newsletter</h1>
        <p className="text-muted-foreground">
          Start with a ready-made idea or create your own from scratch
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowPicker(true)}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Pick an Idea</CardTitle>
                <CardDescription>Browse curated newsletter templates</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Choose from seasonal tips, product features, holiday spotlights, and AI-generated ideas.
            </p>
            <Button className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Browse Ideas
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-lg">Start Blank</CardTitle>
                <CardDescription>Create from scratch</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Begin with an empty canvas and build your newsletter exactly as you envision it.
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/crm/campaigns/new?type=newsletter')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Start Blank
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Newsletter Picker Modal */}
      <NewsletterPicker 
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
      />
    </div>
  );
};