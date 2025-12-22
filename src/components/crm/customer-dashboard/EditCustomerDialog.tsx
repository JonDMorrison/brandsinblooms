import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Mail, MessageSquare } from 'lucide-react';
import { useUpdateCustomer } from '@/hooks/useUpdateCustomer';

const editCustomerSchema = z.object({
  first_name: z.string().trim().max(100, 'First name must be less than 100 characters').optional(),
  last_name: z.string().trim().max(100, 'Last name must be less than 100 characters').optional(),
  email: z.string().trim().email('Invalid email address').max(255, 'Email must be less than 255 characters'),
  phone: z.string().trim().max(20, 'Phone must be less than 20 characters').optional(),
  email_opt_in: z.boolean().optional(),
  sms_opt_in: z.boolean().optional(),
});

type EditCustomerFormData = z.infer<typeof editCustomerSchema>;

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  initialData: {
    first_name?: string | null;
    last_name?: string | null;
    email: string;
    phone?: string | null;
    email_opt_in?: boolean | null;
    sms_opt_in?: boolean | null;
  };
  onSuccess?: () => void;
}

export const EditCustomerDialog: React.FC<EditCustomerDialogProps> = ({
  open,
  onOpenChange,
  customerId,
  initialData,
  onSuccess,
}) => {
  const updateCustomer = useUpdateCustomer();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
    reset,
  } = useForm<EditCustomerFormData>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: {
      first_name: initialData.first_name || '',
      last_name: initialData.last_name || '',
      email: initialData.email,
      phone: initialData.phone || '',
      email_opt_in: initialData.email_opt_in ?? false,
      sms_opt_in: initialData.sms_opt_in ?? false,
    },
  });

  // Reset form when dialog opens with new data
  React.useEffect(() => {
    if (open) {
      reset({
        first_name: initialData.first_name || '',
        last_name: initialData.last_name || '',
        email: initialData.email,
        phone: initialData.phone || '',
        email_opt_in: initialData.email_opt_in ?? false,
        sms_opt_in: initialData.sms_opt_in ?? false,
      });
    }
  }, [open, initialData, reset]);

  const onSubmit = async (data: EditCustomerFormData) => {
    try {
      await updateCustomer.mutateAsync({
        customerId,
        data: {
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          email: data.email,
          phone: data.phone || null,
          email_opt_in: data.email_opt_in ?? false,
          sms_opt_in: data.sms_opt_in ?? false,
        },
      });
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error is handled by the mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update customer information. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  placeholder="John"
                  {...register('first_name')}
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  placeholder="Doe"
                  {...register('last_name')}
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive">{errors.last_name.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                {...register('phone')}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
            
            {/* Opt-in Preferences */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-medium mb-3 block">Communication Preferences</Label>
              <div className="space-y-3">
                <Controller
                  name="email_opt_in"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="email_opt_in" className="text-sm font-normal cursor-pointer">
                          Email Marketing
                        </Label>
                      </div>
                      <Switch
                        id="email_opt_in"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
                <Controller
                  name="sms_opt_in"
                  control={control}
                  render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="sms_opt_in" className="text-sm font-normal cursor-pointer">
                          SMS Marketing
                        </Label>
                      </div>
                      <Switch
                        id="sms_opt_in"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateCustomer.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateCustomer.isPending || !isDirty}
            >
              {updateCustomer.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCustomerDialog;
