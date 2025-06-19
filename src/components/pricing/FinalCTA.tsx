
import { Button } from "@/components/ui/button";

interface FinalCTAProps {
  subscription: any;
  onStartTrial: () => void;
}

export const FinalCTA = ({ subscription, onStartTrial }: FinalCTAProps) => {
  if (subscription) return null;

  return (
    <section className="py-12 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-semibold mb-4 text-garden-green-dark">
          Not sure where to start?
        </h2>
        
        <p className="text-base text-gray-600 mb-10">
          Try it free for 14 days — no credit card required.
        </p>
        
        <Button 
          onClick={onStartTrial}
          className="bg-garden-green hover:bg-garden-green-dark text-white px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
        >
          Start Free Trial
        </Button>
      </div>
    </section>
  );
};
