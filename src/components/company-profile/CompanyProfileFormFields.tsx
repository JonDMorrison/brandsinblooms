import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CompanyProfileFormFieldsProps {
  formData: {
    company_name: string;
    company_overview: string;
    mission_statement: string;
    brand_voice: string;
    tone_of_writing: string;
    target_audience: string;
    ideal_customer: string;
    unique_selling_points: string;
    company_values: string;
    seasonal_focus: string;
    specializations: string;
    location_info: string;
  };
  isEditing: boolean;
  onInputChange: (field: string, value: string) => void;
}

export const CompanyProfileFormFields = ({ formData, isEditing, onInputChange }: CompanyProfileFormFieldsProps) => {
  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <Label htmlFor="company_name" className="text-lg font-semibold">Company Name</Label>
        <Input
          id="company_name"
          placeholder="Your garden center name"
          value={formData.company_name}
          onChange={(e) => onInputChange('company_name', e.target.value)}
          disabled={!isEditing}
          className="text-2xl p-4 h-12"
        />
      </div>

      <div>
        <Label htmlFor="company_overview" className="text-lg font-semibold">Company Overview</Label>
        <Textarea
          id="company_overview"
          placeholder="Brief description of your garden center, what you do, and what makes you special"
          value={formData.company_overview}
          onChange={(e) => onInputChange('company_overview', e.target.value)}
          disabled={!isEditing}
          rows={4}
          className="text-lg p-4"
        />
      </div>

      <div>
        <Label htmlFor="brand_voice" className="text-lg font-semibold">Brand Voice</Label>
        <Textarea
          id="brand_voice"
          placeholder="How your brand speaks (e.g., friendly and approachable, expert and authoritative, warm and family-oriented)"
          value={formData.brand_voice}
          onChange={(e) => onInputChange('brand_voice', e.target.value)}
          disabled={!isEditing}
          rows={3}
          className="text-lg p-4"
        />
      </div>

      <div>
        <Label htmlFor="tone_of_writing" className="text-lg font-semibold">Tone of Writing</Label>
        <Textarea
          id="tone_of_writing"
          placeholder="Describe your preferred writing style (e.g., casual and conversational, professional but warm, educational and helpful)"
          value={formData.tone_of_writing}
          onChange={(e) => onInputChange('tone_of_writing', e.target.value)}
          disabled={!isEditing}
          rows={3}
          className="text-lg p-4"
        />
      </div>

      <div>
        <Label htmlFor="target_audience" className="text-lg font-semibold">Target Audience</Label>
        <Textarea
          id="target_audience"
          placeholder="Who are your main customers? (e.g., home gardeners, landscape professionals, plant enthusiasts)"
          value={formData.target_audience}
          onChange={(e) => onInputChange('target_audience', e.target.value)}
          disabled={!isEditing}
          rows={3}
          className="text-lg p-4"
        />
      </div>

      <div>
        <Label htmlFor="ideal_customer" className="text-lg font-semibold">Ideal Customer Profile</Label>
        <Textarea
          id="ideal_customer"
          placeholder="Detailed description of your perfect customer (demographics, interests, gardening experience level)"
          value={formData.ideal_customer}
          onChange={(e) => onInputChange('ideal_customer', e.target.value)}
          disabled={!isEditing}
          rows={3}
          className="text-lg p-4"
        />
      </div>

      <div>
        <Label htmlFor="unique_selling_points" className="text-lg font-semibold">Unique Selling Points</Label>
        <Textarea
          id="unique_selling_points"
          placeholder="What sets you apart from other garden centers? (e.g., expert advice, rare plants, local focus)"
          value={formData.unique_selling_points}
          onChange={(e) => onInputChange('unique_selling_points', e.target.value)}
          disabled={!isEditing}
          rows={3}
          className="text-lg p-4"
        />
      </div>

      <div>
        <Label htmlFor="company_values" className="text-lg font-semibold">Company Values</Label>
        <Textarea
          id="company_values"
          placeholder="Core values that drive your business (e.g., sustainability, community support, quality)"
          value={formData.company_values}
          onChange={(e) => onInputChange('company_values', e.target.value)}
          disabled={!isEditing}
          rows={3}
          className="text-lg p-4"
        />
      </div>

      <div>
        <Label htmlFor="seasonal_focus" className="text-lg font-semibold">Seasonal Focus</Label>
        <Textarea
          id="seasonal_focus"
          placeholder="Key seasonal events, promotions, or focuses throughout the year"
          value={formData.seasonal_focus}
          onChange={(e) => onInputChange('seasonal_focus', e.target.value)}
          disabled={!isEditing}
          rows={3}
          className="text-lg p-4"
        />
      </div>

      <div>
        <Label htmlFor="specializations" className="text-lg font-semibold">Specializations</Label>
        <Textarea
          id="specializations"
          placeholder="Areas of expertise (e.g., native plants, organic gardening, landscaping, indoor plants)"
          value={formData.specializations}
          onChange={(e) => onInputChange('specializations', e.target.value)}
          disabled={!isEditing}
          rows={3}
          className="text-lg p-4"
        />
      </div>

      <div>
        <Label htmlFor="location_info" className="text-lg font-semibold">Location Information</Label>
        <Textarea
          id="location_info"
          placeholder="Location details, climate zone, local growing conditions, community context"
          value={formData.location_info}
          onChange={(e) => onInputChange('location_info', e.target.value)}
          disabled={!isEditing}
          rows={3}
          className="text-lg p-4"
        />
      </div>

      <div>
        <Label htmlFor="mission_statement" className="text-lg font-semibold">Mission Statement</Label>
        <Textarea
          id="mission_statement"
          placeholder="Your company's mission statement - the fundamental purpose and values that drive your business"
          value={formData.mission_statement}
          onChange={(e) => onInputChange('mission_statement', e.target.value)}
          disabled={!isEditing}
          rows={3}
          className="text-lg p-4"
        />
      </div>
    </div>
  );
};
