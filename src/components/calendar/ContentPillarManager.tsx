
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const DEFAULT_PILLARS = [
  { name: "Educational", color: "bg-blue-100 text-blue-800", description: "Tips, how-tos, plant care guides" },
  { name: "Seasonal", color: "bg-green-100 text-green-800", description: "Seasonal plants, weather tips" },
  { name: "Product Focus", color: "bg-purple-100 text-purple-800", description: "Showcase products and services" },
  { name: "Community", color: "bg-orange-100 text-orange-800", description: "Customer stories, local events" },
  { name: "Behind Scenes", color: "bg-gray-100 text-gray-800", description: "Team, processes, nursery life" },
  { name: "Inspiration", color: "bg-pink-100 text-pink-800", description: "Garden ideas, design inspiration" },
];

interface ContentPillar {
  name: string;
  color: string;
  description: string;
}

interface ContentPillarManagerProps {
  selectedPillar?: string;
  onPillarSelect: (pillar: string | undefined) => void;
}

export const ContentPillarManager = ({ selectedPillar, onPillarSelect }: ContentPillarManagerProps) => {
  const [pillars, setPillars] = useState<ContentPillar[]>(DEFAULT_PILLARS);
  const [newPillar, setNewPillar] = useState({ name: "", description: "" });
  const [isOpen, setIsOpen] = useState(false);

  const addPillar = () => {
    if (!newPillar.name.trim()) return;

    const colors = [
      "bg-red-100 text-red-800",
      "bg-yellow-100 text-yellow-800",
      "bg-indigo-100 text-indigo-800",
      "bg-teal-100 text-teal-800",
    ];
    
    const newPillarObj = {
      ...newPillar,
      color: colors[pillars.length % colors.length]
    };

    setPillars([...pillars, newPillarObj]);
    setNewPillar({ name: "", description: "" });
  };

  const removePillar = (index: number) => {
    setPillars(pillars.filter((_, i) => i !== index));
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">Content Pillars:</span>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-6 px-2">
              <Plus className="w-3 h-3 mr-1" />
              Manage
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Content Pillars</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {pillars.map((pillar, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Badge className={pillar.color} variant="secondary">
                        {pillar.name}
                      </Badge>
                      <p className="text-xs text-gray-600 mt-1">{pillar.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removePillar(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">Add New Pillar</h4>
                <div className="space-y-2">
                  <Input
                    placeholder="Pillar name"
                    value={newPillar.name}
                    onChange={(e) => setNewPillar({ ...newPillar, name: e.target.value })}
                  />
                  <Input
                    placeholder="Description"
                    value={newPillar.description}
                    onChange={(e) => setNewPillar({ ...newPillar, description: e.target.value })}
                  />
                  <Button onClick={addPillar} size="sm">
                    Add Pillar
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={selectedPillar === undefined ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => onPillarSelect(undefined)}
        >
          All Content
        </Badge>
        {pillars.map((pillar, index) => (
          <Badge
            key={index}
            variant={selectedPillar === pillar.name ? "default" : "outline"}
            className={`cursor-pointer ${selectedPillar === pillar.name ? '' : pillar.color}`}
            onClick={() => onPillarSelect(pillar.name)}
          >
            {pillar.name}
          </Badge>
        ))}
      </div>
    </div>
  );
};
