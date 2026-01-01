import { Card, CardContent } from '@/components/ui/card';
import { Gift, CalendarClock, Lightbulb } from 'lucide-react';

const features = [
  {
    icon: Gift,
    title: 'Promotions and Offers',
    description: 'Receive exclusive deals, discounts, and special promotions directly to your phone.',
  },
  {
    icon: CalendarClock,
    title: 'Event Notices and Reminders',
    description: 'Stay informed about upcoming webinars, office hours, and important events.',
  },
  {
    icon: Lightbulb,
    title: 'Product Updates and Tips',
    description: 'Get the latest feature announcements and helpful tips to grow your business.',
  },
];

export const FeatureGrid = () => {
  return (
    <section className="py-12 px-6 bg-muted/20">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">
          What You'll Receive
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
