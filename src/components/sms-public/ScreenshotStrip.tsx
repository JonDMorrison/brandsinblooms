import { Card, CardContent } from '@/components/ui-legacy/card';
import { PlusCircle, Send, BarChart3 } from 'lucide-react';

const screenshots = [
  {
    icon: PlusCircle,
    caption: 'Create a Campaign',
    description: 'Build engaging SMS campaigns in minutes',
  },
  {
    icon: Send,
    caption: 'Send a Broadcast',
    description: 'Reach your audience instantly',
  },
  {
    icon: BarChart3,
    caption: 'Track Results',
    description: 'Monitor performance and optimize',
  },
];

export const ScreenshotStrip = () => {
  return (
    <section className="py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">
          How It Works
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {screenshots.map((item, index) => (
            <div key={index} className="text-center">
              {/* Placeholder Image */}
              <Card className="aspect-video bg-muted/50 border-2 border-dashed border-border mb-4 overflow-hidden">
                <CardContent className="h-full flex items-center justify-center p-6">
                  <div className="text-center">
                    <item.icon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Screenshot placeholder
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              {/* Caption */}
              <h3 className="font-semibold text-foreground mb-1">
                {item.caption}
              </h3>
              <p className="text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
