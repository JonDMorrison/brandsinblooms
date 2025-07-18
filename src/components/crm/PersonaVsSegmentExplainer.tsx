
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Target, ChevronDown, ChevronUp } from 'lucide-react';

export function PersonaVsSegmentExplainer() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-t pt-4 mt-4">
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between text-sm text-muted-foreground hover:text-foreground"
      >
        What's the difference between personas and segments?
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      
      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-purple-200 bg-purple-50/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Users className="h-4 w-4 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-purple-900">Personas</h4>
                </div>
                <p className="text-sm text-purple-800 mb-3">
                  Fictional profiles representing customer types
                </p>
                <div className="space-y-2 text-xs text-purple-700">
                  <div>• <strong>Purpose:</strong> Personalize messaging</div>
                  <div>• <strong>Example:</strong> "DIY Dana" - loves hands-on projects</div>
                  <div>• <strong>Used for:</strong> Content tone, product suggestions</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-teal-200 bg-teal-50/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                    <Target className="h-4 w-4 text-teal-600" />
                  </div>
                  <h4 className="font-semibold text-teal-900">Segments</h4>
                </div>
                <p className="text-sm text-teal-800 mb-3">
                  Real groups of customers with shared traits
                </p>
                <div className="space-y-2 text-xs text-teal-700">
                  <div>• <strong>Purpose:</strong> Target specific audiences</div>
                  <div>• <strong>Example:</strong> "Loyalty Members" - 847 customers</div>
                  <div>• <strong>Used for:</strong> Campaign targeting, analytics</div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Pro tip:</strong> Use personas to craft the right message, then use segments to send it to the right people.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
