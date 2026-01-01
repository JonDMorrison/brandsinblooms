import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { formatPhoneForTwilio } from '@/lib/utils/phoneFormatter';
import { SMS_BRAND_CONFIG } from '@/config/smsConfig';
import { Link } from 'react-router-dom';

// E.164 phone validation
const phoneRegex = /^[\d\s\-()+ ]+$/;

const consentFormSchema = z.object({
  firstName: z.string().max(50, 'First name must be less than 50 characters').optional(),
  mobileNumber: z
    .string()
    .min(10, 'Please enter a valid phone number')
    .max(20, 'Phone number is too long')
    .regex(phoneRegex, 'Please enter a valid phone number')
    .refine((val) => {
      const cleaned = val.replace(/\D/g, '');
      return cleaned.length >= 10 && cleaned.length <= 15;
    }, 'Please enter a valid 10-digit phone number'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to receive SMS messages to subscribe' }),
  }),
});

type ConsentFormData = z.infer<typeof consentFormSchema>;

export const ConsentForm = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ConsentFormData>({
    resolver: zodResolver(consentFormSchema),
    defaultValues: {
      firstName: '',
      mobileNumber: '',
      consent: undefined,
    },
  });

  const consentChecked = watch('consent');

  const onSubmit = async (data: ConsentFormData) => {
    setIsSubmitting(true);
    
    // Normalize phone to E.164
    const normalizedPhone = formatPhoneForTwilio(data.mobileNumber);
    console.log('Consent form submitted:', {
      firstName: data.firstName,
      phone: normalizedPhone,
      consentTimestamp: new Date().toISOString(),
    });

    // Simulate brief processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <Card className="bg-card border-2 border-primary/20">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Thanks!
          </h3>
          <p className="text-muted-foreground">
            We have received your request. If double opt-in is enabled you will 
            receive a text asking you to reply YES to confirm.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-2 border-border">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* First Name (optional) */}
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name (optional)</Label>
            <Input
              id="firstName"
              placeholder="Your first name"
              {...register('firstName')}
              className={errors.firstName ? 'border-destructive' : ''}
            />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>

          {/* Mobile Number (required) */}
          <div className="space-y-2">
            <Label htmlFor="mobileNumber">
              Mobile Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="mobileNumber"
              type="tel"
              inputMode="tel"
              placeholder="(555) 123-4567"
              {...register('mobileNumber')}
              className={errors.mobileNumber ? 'border-destructive' : ''}
              aria-required="true"
            />
            {errors.mobileNumber && (
              <p className="text-sm text-destructive">{errors.mobileNumber.message}</p>
            )}
          </div>

          {/* Consent Checkbox (required) */}
          <div className="space-y-2">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="consent"
                checked={consentChecked === true}
                onCheckedChange={(checked) => 
                  setValue('consent', checked === true ? true : undefined as any)
                }
                aria-required="true"
                aria-labelledby="consent-label"
                className="mt-1"
              />
              <Label
                id="consent-label"
                htmlFor="consent"
                className="text-sm leading-relaxed cursor-pointer"
              >
                I agree to receive recurring marketing text messages from BloomSuite. 
                Msg and Data rates may apply. Reply HELP for help, STOP to cancel. See{' '}
                <Link to="/terms" className="text-primary underline hover:text-primary/80">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary underline hover:text-primary/80">
                  Privacy
                </Link>
                .
                <span className="text-destructive ml-1">*</span>
              </Label>
            </div>
            {errors.consent && (
              <p className="text-sm text-destructive">{errors.consent.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Subscribing...' : 'Subscribe to SMS'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
