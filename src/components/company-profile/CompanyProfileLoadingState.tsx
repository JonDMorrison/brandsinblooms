
import { Loader } from "lucide-react";

export const CompanyProfileLoadingState = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <Loader className="w-12 h-12 animate-spin text-primary" />
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-primary">Please be patient. Content is coming...</h3>
        <p className="text-gray-600">We're analyzing your business information and creating your personalized company profile.</p>
      </div>
    </div>
  );
};
