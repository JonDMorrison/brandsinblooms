import { Button } from "@/components/ui-legacy/button";
import { Trash2 } from "lucide-react";
import { useDeleteCustomers } from "@/hooks/useDeleteCustomers";
import { useTenant } from "@/hooks/useTenant";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui-legacy/alert-dialog";

interface DeleteCustomersActionProps {
  keepEmail: string;
}

export const DeleteCustomersAction = ({ keepEmail }: DeleteCustomersActionProps) => {
  const { tenant } = useTenant();
  const deleteCustomers = useDeleteCustomers();

  const handleDelete = () => {
    if (!tenant?.id) {
      return;
    }
    deleteCustomers.mutate({
      keepEmail,
      tenantId: tenant.id,
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete All Except {keepEmail}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete All Customers?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete all customers except <strong>{keepEmail}</strong>.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete All Others
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
