import { AutomationRules } from "@/components/automation/AutomationRules";
import { AutomationPresets } from "@/components/automation/AutomationPresets";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const AutomationPage = () => {
  const [showPresets, setShowPresets] = useState(true);
  const navigate = useNavigate();

  const handlePresetSelection = (preset: any) => {
    // Navigate to the CRM automation guide page with preset selection
    navigate('/crm/automations/new/guide', { state: { selectedPreset: preset } });
  };

  const handleCreateCustom = () => {
    navigate('/crm/automations/new/guide');
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {showPresets ? (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Automation Center</h1>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Streamline your customer engagement with automated workflows. Choose from proven templates or create your own custom automation.
              </p>
            </div>
            <AutomationPresets
              onSelectPreset={handlePresetSelection}
              onCreateCustom={handleCreateCustom}
            />
          </div>
        ) : (
          <AutomationRules />
        )}
      </div>
    </div>
  );
};

export default AutomationPage;