
import { Button } from "@/components/ui/button";

interface FinalCTAProps {
  subscription: any;
  onStartTrial: () => void;
}

export const FinalCTA = ({ subscription, onStartTrial }: FinalCTAProps) => {
  if (subscription) return null;

  return (
    <section className="relative py-12 px-6 overflow-hidden bg-gradient-to-br from-brand-teal-mint/10 via-surface-primary to-brand-steel-blue/10">
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-10 left-1/4 w-72 h-72 bg-gradient-to-br from-brand-steel-blue/15 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-gradient-to-br from-brand-teal-mint/10 to-transparent rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative max-w-4xl mx-auto text-center">
        <div className="bg-white/40 backdrop-blur-sm border border-white/30 rounded-2xl p-12 shadow-2xl">
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-brand-steel-blue via-brand-teal-mint to-brand-steel-blue bg-clip-text text-transparent">
            Not sure where to start?
          </h2>
          
          <p className="text-xl text-text-secondary mb-10 leading-relaxed">
            Try it free for 14 days — no credit card required.
          </p>
          
          <div className="relative group">
            <Button 
              onClick={onStartTrial}
              className="bg-gradient-to-r from-brand-teal-mint via-brand-steel-blue to-brand-teal-mint hover:from-brand-steel-blue hover:to-brand-teal-mint text-white px-12 py-4 text-xl rounded-2xl shadow-2xl hover:shadow-brand-teal-mint/25 transition-all duration-300 hover:scale-105 border border-white/20 backdrop-blur-sm"
            >
              Start Free Trial
            </Button>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-teal-mint/20 via-brand-steel-blue/20 to-brand-teal-mint/20 rounded-2xl blur-xl group-hover:blur-lg transition-all duration-300"></div>
          </div>
        </div>
      </div>
    </section>
  );
};
