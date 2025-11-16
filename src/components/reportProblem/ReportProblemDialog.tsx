import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCreateProblem } from '@/hooks/reportProblem/useCreateProblem';
import { X, Upload, FileIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const reportSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must not exceed 200 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must not exceed 5000 characters'),
});

type ReportFormData = z.infer<typeof reportSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReportProblemDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const createProblem = useCreateProblem();
  const [files, setFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
  });

  // Auto-capture metadata
  const capturedUrl = window.location.href;
  const userAgent = navigator.userAgent;
  const viewportSize = `${window.innerWidth}x${window.innerHeight}`;
  const browserInfo = {
    platform: navigator.platform,
    language: navigator.language,
    online: navigator.onLine,
    cookieEnabled: navigator.cookieEnabled,
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles].slice(0, 5));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
    },
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024,
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: ReportFormData) => {
    await createProblem.mutateAsync({
      title: data.title,
      description: data.description,
      capturedUrl,
      userAgent,
      viewportSize,
      browserInfo,
      attachments: files,
    });

    reset();
    setFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a Problem</DialogTitle>
          <DialogDescription>
            Describe the issue you're experiencing and we'll look into it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Problem Title *</Label>
            <Input
              id="title"
              placeholder="Brief description of the issue"
              {...register('title')}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Detailed Description *</Label>
            <Textarea
              id="description"
              placeholder="Please provide as much detail as possible about the problem..."
              rows={5}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Auto-captured info (read-only) */}
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <h4 className="text-sm font-medium">Auto-Captured Information</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><strong>URL:</strong> {capturedUrl}</p>
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>Viewport:</strong> {viewportSize}</p>
            </div>
          </div>

          {/* File Attachments */}
          <div className="space-y-2">
            <Label>Attachments (optional)</Label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {isDragActive
                  ? 'Drop files here...'
                  : 'Drag & drop files here, or click to select'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max 5 files, 10MB each (Images, PDFs, Text)
              </p>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                  >
                    <div className="flex items-center gap-2">
                      <FileIcon className="h-4 w-4" />
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createProblem.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createProblem.isPending}>
              {createProblem.isPending ? 'Submitting...' : 'Submit Problem'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
