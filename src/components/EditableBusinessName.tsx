
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
interface EditableBusinessNameProps {
  businessName: string;
  onBusinessNameChange: (newName: string) => void;
}
export const EditableBusinessName = ({
  businessName,
  onBusinessNameChange
}: EditableBusinessNameProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState(businessName);
  const handleSave = () => {
    if (newName.trim()) {
      onBusinessNameChange(newName.trim());
      setIsOpen(false);
    }
  };
  const handleCancel = () => {
    setNewName(businessName);
    setIsOpen(false);
  };
  return <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <span title="Click to edit business name" className="font-semibold cursor-pointer hover:text-garden-green-dark transition-colors text-slate-950">
          {businessName}
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Business Name</DialogTitle>
          <DialogDescription>
            Update your business name. This will be displayed throughout the app.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="business-name" className="text-right">
              Name
            </Label>
            <Input id="business-name" value={newName} onChange={e => setNewName(e.target.value)} className="col-span-3" placeholder="Enter business name" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!newName.trim()}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>;
};
