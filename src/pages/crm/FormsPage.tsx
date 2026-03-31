import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Plus, Eye, Trash2, MoreHorizontal, Copy, Layout, Search, AlertTriangle, RefreshCw } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useForms, useFormSubmissions } from '@/hooks/useForms';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { FormTemplatesDialog } from '@/components/forms/FormTemplatesDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function FormsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { forms, isLoading, error, deleteForm, isDeleting, createForm, isCreating } = useForms();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{ id: string; name: string } | null>(null);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);

  // Fix 12: Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const handleDeleteClick = (form: { id: string; name: string }) => {
    setFormToDelete(form);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!formToDelete) return;
    await deleteForm(formToDelete.id);
    setDeleteDialogOpen(false);
    setFormToDelete(null);
  };

  const handleCreateBlank = async () => {
    try {
      const form = await createForm({ name: 'Untitled Form' });
      if (form) {
        navigate(`/crm/forms/${form.id}`);
      }
    } catch (err) {
      // Error toast is already shown by useForms mutation onError; log for debugging
      console.error('[FormsPage] handleCreateBlank failed:', err);
    }
  };

  const handleTemplateSelect = async (templateData: any) => {
    try {
      const form = await createForm({
        name: templateData.name || 'Untitled Form',
        fields_json: templateData.fields_json,
        settings_json: templateData.settings_json,
        compliance_json: templateData.compliance_json,
      });
      setTemplatesDialogOpen(false);
      if (form) {
        navigate(`/crm/forms/${form.id}`);
      }
    } catch (err) {
      // Error toast is already shown by useForms mutation onError; log for debugging
      console.error('[FormsPage] handleTemplateSelect failed:', err);
      setTemplatesDialogOpen(false);
    }
  };

  // Fix 11: Duplicate form
  const handleDuplicate = async (form: any) => {
    try {
      const newForm = await createForm({
        name: `${form.name} (Copy)`,
        fields_json: form.fields_json,
        settings_json: form.settings_json,
        compliance_json: form.compliance_json,
      });
      if (newForm) {
        toast({
          title: 'Form duplicated',
          description: `"${form.name}" has been duplicated.`,
        });
        navigate(`/crm/forms/${newForm.id}`);
      }
    } catch (err: any) {
      toast({
        title: 'Error duplicating form',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Fix 12: Filtered forms
  const filteredForms = useMemo(() => {
    return forms.filter(form => {
      if (searchQuery && !form.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'all' && form.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [forms, searchQuery, statusFilter]);

  const publishedForms = forms.filter(f => f.status === 'published').length;
  const draftForms = forms.filter(f => f.status === 'draft').length;
  const totalForms = forms.length;

  // Fix 7: Removed duplicate getStatusBadge — only standalone function below is used

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Forms</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTemplatesDialogOpen(true)}>
            <Layout className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button onClick={handleCreateBlank} disabled={isCreating}>
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              Failed to load forms.{' '}
              {error instanceof Error ? error.message : 'Please check your connection and try again.'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['forms'] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Forms</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalForms}</div>
            <p className="text-xs text-muted-foreground">All forms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publishedForms}</div>
            <p className="text-xs text-muted-foreground">Live forms</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftForms}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Fix 12: Search and filter */}
      {forms.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search forms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <NativeSelect
            label=""
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
              { value: 'archived', label: 'Archived' },
            ]}
            className="w-40"
          />
          {(searchQuery || statusFilter !== 'all') && (
            <span className="text-sm text-muted-foreground">
              Showing {filteredForms.length} of {forms.length} forms
            </span>
          )}
        </div>
      )}

      {/* Forms List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filteredForms.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Your Forms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredForms.map((form) => (
                <FormListItem
                  key={form.id}
                  form={form}
                  onDelete={() => handleDeleteClick({ id: form.id, name: form.name })}
                  onDuplicate={() => handleDuplicate(form)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : forms.length > 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No forms match your search</p>
            <Button variant="link" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Get Started with Forms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Create lead capture forms to grow your email list and collect customer information. 
                Forms can be embedded on your website or shared as standalone links.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setTemplatesDialogOpen(true)}>
                  <Layout className="h-4 w-4 mr-2" />
                  Start from Template
                </Button>
                <Button onClick={handleCreateBlank} disabled={isCreating}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Blank Form
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Form"
        description={`Are you sure you want to delete "${formToDelete?.name}"? This will also delete all submissions. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        loading={isDeleting}
      />

      {/* Templates Dialog */}
      <FormTemplatesDialog
        open={templatesDialogOpen}
        onOpenChange={setTemplatesDialogOpen}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}

// Fix 11: Added onDuplicate prop
function FormListItem({ 
  form, 
  onDelete,
  onDuplicate,
}: { 
  form: any; 
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const { data: submissionsData } = useFormSubmissions(form.id, 7);

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1">
        <NavLink to={`/crm/forms/${form.id}`} className="block group">
          <h3 className="font-semibold group-hover:text-primary transition-colors cursor-pointer">
            {form.name}
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground">
              Updated: {new Date(form.updated_at).toLocaleDateString()}
            </span>
            <span className="text-xs text-muted-foreground">
              {submissionsData?.count || 0} submissions (7d)
            </span>
          </div>
        </NavLink>
      </div>
      <div className="flex items-center gap-2">
        {getStatusBadge(form.status)}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <NavLink to={`/crm/forms/${form.id}`}>
                <Eye className="h-4 w-4 mr-2" />
                Edit
              </NavLink>
            </DropdownMenuItem>
            {form.status === 'published' && (
              <DropdownMenuItem onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/f/${form.embed_key}`);
              }}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </DropdownMenuItem>
            )}
            {/* Fix 11: Duplicate option */}
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Fix 7: Single standalone getStatusBadge function (removed duplicate component method)
function getStatusBadge(status: string) {
  switch (status) {
    case 'published':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Published</Badge>;
    case 'archived':
      return <Badge variant="secondary">Archived</Badge>;
    default:
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Draft</Badge>;
  }
}
