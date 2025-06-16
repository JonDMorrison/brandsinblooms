import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface EditableBusinessNameProps {
  businessName: string;
  onBusinessNameChange: (newName: string) => void;
}

export const EditableBusinessName = ({
  businessName,
  onBusinessNameChange
}: EditableBusinessNameProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState(businessName);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!newName.trim() || !user) return;
    
    setIsSaving(true);
    
    try {
      // Update company profile with new business name
      const { error: profileError } = await supabase
        .from('company_profiles')
        .upsert({
          user_id: user.id,
          company_name: newName.trim()
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error('Error updating company profile:', profileError);
        throw new Error('Failed to update company profile');
      }

      // Update local state
      onBusinessNameChange(newName.trim());
      
      // Update localStorage onboarding data to keep it in sync
      const onboardingKey = `garden-center-onboarding-${user.id}`;
      const existingData = localStorage.getItem(onboardingKey);
      if (existingData) {
        try {
          const parsedData = JSON.parse(existingData);
          parsedData.aboutBusiness = `${newName.trim()} has been serving the community with quality gardening products and expert advice.`;
          localStorage.setItem(onboardingKey, JSON.stringify(parsedData));
        } catch (error) {
          console.error('Error updating localStorage:', error);
        }
      }

      toast.success('Business name updated successfully!');
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving business name:', error);
      toast.error('Failed to update business name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNewName(businessName);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <span 
          title="Click to edit business name" 
          className="font-bold cursor-pointer hover:text-garden-green-dark transition-colors text-slate-950"
        >
          {businessName}
        </span>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Business Name</DialogTitle>
          <DialogDescription>
            Update your business name. This will be displayed throughout the app and used in AI-generated content.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="business-name" className="text-right">
              Name
            </Label>
            <Input 
              id="business-name" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              className="col-span-3" 
              placeholder="Enter business name"
              disabled={isSaving}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!newName.trim() || isSaving}>
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
