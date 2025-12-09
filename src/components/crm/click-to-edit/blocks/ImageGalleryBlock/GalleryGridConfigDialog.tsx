import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Grid3X3 } from 'lucide-react';

interface GalleryGridConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentRows: number;
  currentColumns: number;
  onApply: (rows: number, columns: number) => void;
}

const rowOptions = [1, 2, 3, 4];
const columnOptions = [2, 3, 4];

export const GalleryGridConfigDialog: React.FC<GalleryGridConfigDialogProps> = ({
  isOpen,
  onClose,
  currentRows,
  currentColumns,
  onApply,
}) => {
  const [rows, setRows] = useState(currentRows);
  const [columns, setColumns] = useState(currentColumns);

  const totalImages = rows * columns;

  const handleApply = () => {
    onApply(rows, columns);
    onClose();
  };

  // Reset state when dialog opens with new values
  React.useEffect(() => {
    if (isOpen) {
      setRows(currentRows);
      setColumns(currentColumns);
    }
  }, [isOpen, currentRows, currentColumns]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-primary" />
            Configure Gallery Grid
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rows Selector */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Rows</Label>
            <div className="flex gap-2">
              {rowOptions.map((option) => (
                <button
                  key={`row-${option}`}
                  type="button"
                  onClick={() => setRows(option)}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-all",
                    "hover:border-primary/50 hover:bg-accent/50",
                    rows === option
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Columns Selector */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Columns</Label>
            <div className="flex gap-2">
              {columnOptions.map((option) => (
                <button
                  key={`col-${option}`}
                  type="button"
                  onClick={() => setColumns(option)}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-all",
                    "hover:border-primary/50 hover:bg-accent/50",
                    columns === option
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Live Grid Preview */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Preview</Label>
            <div 
              className={cn(
                "grid gap-1.5 p-4 rounded-lg border bg-muted/30",
              )}
              style={{ 
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
              }}
            >
              {Array.from({ length: totalImages }).map((_, idx) => (
                <div
                  key={`preview-${idx}`}
                  className={cn(
                    "aspect-[4/3] rounded-md bg-primary/20 border border-primary/30",
                    "transition-all duration-200 animate-scale-in"
                  )}
                  style={{ animationDelay: `${idx * 30}ms` }}
                />
              ))}
            </div>
          </div>

          {/* Total Images Indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-accent/50 rounded-lg py-2">
            <span>This will create</span>
            <span className="font-semibold text-foreground">{totalImages}</span>
            <span>image slots</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply Layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
