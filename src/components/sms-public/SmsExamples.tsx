import { Card, CardContent } from '@/components/ui/card';
import { Smartphone } from 'lucide-react';

const exampleMessages = [
  {
    id: 1,
    text: 'BloomSuite: New release is live. Details: https://bloomsuite.app/updates\nHELP=help, STOP=cancel',
  },
  {
    id: 2,
    text: 'BloomSuite: Webinar Thu 10am PT. Save your seat: https://bloomsuite.app/webinars\nHELP=help, STOP=cancel',
  },
  {
    id: 3,
    text: 'BloomSuite: Tips to grow your list. Read: https://bloomsuite.app/blog/sms-tips\nHELP=help, STOP=cancel',
  },
];

export const SmsExamples = () => {
  return (
    <section className="py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">
          Example Messages
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {exampleMessages.map((message) => (
            <Card key={message.id} className="bg-muted/30 border-border overflow-hidden">
              <CardContent className="p-0">
                {/* Phone Header */}
                <div className="bg-muted px-4 py-2 flex items-center gap-2 border-b border-border">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Text Message
                  </span>
                </div>
                
                {/* Message Bubble */}
                <div className="p-4">
                  <div className="bg-primary/10 rounded-2xl rounded-tl-sm p-4">
                    <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                      {message.text}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
