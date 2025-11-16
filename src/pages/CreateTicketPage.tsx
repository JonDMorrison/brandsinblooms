import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { ArrowLeft } from 'lucide-react';
import { useCreateTicket } from '@/hooks/helpdesk/useCreateTicket';
import { useCategories } from '@/hooks/helpdesk/useCategories';

const formSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  category_id: z.string().optional(),
});

const CreateTicketPage = () => {
  const navigate = useNavigate();
  const createTicket = useCreateTicket();
  const { data: categories } = useCategories();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: '',
      description: '',
      priority: 'medium',
      category_id: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const ticket = await createTicket.mutateAsync({
        subject: values.subject,
        description: values.description,
        priority: values.priority,
        category_id: values.category_id || undefined,
      });
      navigate(`/helpdesk/tickets/${ticket.id}`);
    } catch (error) {
      // Error is already handled by the mutation's onError
      console.error('Failed to create ticket:', error);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/helpdesk')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Support Ticket</h1>
          <p className="text-muted-foreground mt-1">
            Describe your issue and we'll help you resolve it
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ticket Details</CardTitle>
          <CardDescription>
            Please provide as much detail as possible to help us assist you better
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of your issue" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide detailed information about your issue..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <FormControl>
                        <NativeSelect
                          {...field}
                          options={[
                            { value: 'low', label: 'Low' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'high', label: 'High' },
                            { value: 'urgent', label: 'Urgent' },
                          ]}
                          placeholder="Select priority"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {categories && categories.length > 0 && (
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <NativeSelect
                            {...field}
                            options={categories.map((category) => ({
                              value: category.id,
                              label: category.name,
                            }))}
                            placeholder="Select category"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/helpdesk')}
                  disabled={createTicket.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTicket.isPending}
                >
                  {createTicket.isPending ? 'Creating...' : 'Create Ticket'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateTicketPage;
