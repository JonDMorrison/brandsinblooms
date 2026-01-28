import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Eye, Trash2, MoreHorizontal, Copy, Layout } from 'lucide-react';
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
import { FormTemplatesDialog } from '@/components/forms/FormTemplatesDialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function FormsPage() {
  const navigate = useNavigate();
  const { forms, isLoading, deleteForm, isDeleting, createForm, isCreating } = useForms();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{ id: string; name: string } | null>(null);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);

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
    const form = await createForm({ name: 'Untitled Form' });
    if (form) {
      navigate(`/crm/forms/${form.id}`);
    }
  };

  const handleTemplateSelect = async (templateData: any) => {
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
  };

  const publishedForms = forms.filter(f => f.status === 'published').length;
  const draftForms = forms.filter(f => f.status === 'draft').length;
  const totalForms = forms.length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Published</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Draft</Badge>;
    }
  };

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
      ) : forms.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Your Forms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {forms.map((form) => (
                <FormListItem
                  key={form.id}
                  form={form}
                  onDelete={() => handleDeleteClick({ id: form.id, name: form.name })}
                />
              ))}
            </div>
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

function FormListItem({ 
  form, 
  onDelete 
}: { 
  form: any; 
  onDelete: () => void;
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
        {form.status === 'published' && getStatusBadge(form.status)}
        {form.status === 'draft' && getStatusBadge(form.status)}
        
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
