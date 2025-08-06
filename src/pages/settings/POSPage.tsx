import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Plus, Trash2, Upload, Settings } from "lucide-react";
import { usePOSConnections } from "@/hooks/usePOSConnections";
import { POSConnectionForm } from "@/components/crm/pos/POSConnectionForm";
import { VMXUploader } from "@/components/crm/pos/VMXUploader";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";

const POSPage = () => {
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [showVMXUploader, setShowVMXUploader] = useState(false);
  
  const {
    connections,
    isLoading,
    runSync,
    disconnectPOS,
    isSyncing,
  } = usePOSConnections();

  const handleConnectNew = (platform: string) => {
    if (platform === 'vmx') {
      setShowVMXUploader(true);
    } else {
      setSelectedPlatform(platform);
      setShowConnectionForm(true);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-500';
      case 'error':
        return 'bg-destructive';
      case 'syncing':
        return 'bg-warning';
      default:
        return 'bg-muted';
    }
  };

  const getStatusText = (status: string | null, isActive: boolean) => {
    if (!isActive) return 'Disconnected';
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Error';
      case 'syncing':
        return 'Syncing';
      default:
        return 'Pending';
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">POS Connections</h1>
          <p className="text-muted-foreground">Manage your point-of-sale integrations</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasConnections = connections && connections.length > 0;

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">POS Connections</h1>
        <p className="text-muted-foreground">
          Manage your point-of-sale integrations and sync customer data
        </p>
      </div>

      {hasConnections ? (
        <div className="grid gap-6 md:grid-cols-2">
          {connections.map((connection) => (
            <Card key={connection.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <CardTitle className="capitalize text-lg">
                        {connection.platform}
                      </CardTitle>
                      <CardDescription>{connection.name}</CardDescription>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={`${getStatusColor(connection.sync_status)} text-primary-foreground`}
                    >
                      {getStatusText(connection.sync_status, connection.is_active)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm">
                  {connection.platform === 'shopify' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shop Domain:</span>
                      <span className="font-medium">
                        {JSON.parse(connection.credentials_encrypted || '{}').shop_domain || 'N/A'}
                      </span>
                    </div>
                  )}
                  
                  {connection.platform === 'square' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium">
                        {connection.settings?.location_name || 'Square Location'}
                      </span>
                    </div>
                  )}
                  
                  {connection.platform === 'vmx' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Upload:</span>
                      <span className="font-medium">
                        {connection.settings?.file_name || 'CSV File'}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Synced:</span>
                    <span className="font-medium">
                      {connection.last_sync_at 
                        ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })
                        : 'Never'
                      }
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runSync(connection.id)}
                    disabled={isSyncing}
                    className="flex-1"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Run Sync'}
                  </Button>

                  {connection.platform === 'vmx' && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload New
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Upload New CSV</DialogTitle>
                          <DialogDescription>
                            Upload a new VMX CSV file to update your customer data
                          </DialogDescription>
                        </DialogHeader>
                        <VMXUploader onSuccess={() => setShowVMXUploader(false)} />
                      </DialogContent>
                    </Dialog>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect POS System</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove this connection and stop data syncing. 
                          Existing customer data will be preserved.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => disconnectPOS(connection.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add New POS Card */}
          <Card className="border-dashed border-2 border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-center">Add New POS</CardTitle>
              <CardDescription className="text-center">
                Connect another point-of-sale system
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <div className="text-4xl mb-4">🛍️</div>
              <div className="grid gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleConnectNew('shopify')}
                  className="w-full"
                >
                  Connect Shopify
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleConnectNew('square')}
                  className="w-full"
                >
                  Connect Square
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleConnectNew('vmx')}
                  className="w-full"
                >
                  Upload VMX CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Empty state when no connections
        <Card className="text-center p-8">
          <div className="text-6xl mb-4">🛍️</div>
          <CardTitle className="mb-2">No POS Systems Connected</CardTitle>
          <CardDescription className="mb-6">
            Connect your first point-of-sale system to start syncing customer data
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => handleConnectNew('shopify')}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Shopify
            </Button>
            <Button variant="outline" onClick={() => handleConnectNew('square')}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Square
            </Button>
            <Button variant="outline" onClick={() => handleConnectNew('vmx')}>
              <Upload className="h-4 w-4 mr-2" />
              Upload VMX CSV
            </Button>
          </div>
        </Card>
      )}

      {/* Connection Form Dialog */}
      <Dialog open={showConnectionForm} onOpenChange={setShowConnectionForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect {selectedPlatform}</DialogTitle>
            <DialogDescription>
              Set up your {selectedPlatform} integration to sync customer data
            </DialogDescription>
          </DialogHeader>
          <POSConnectionForm
            platform={selectedPlatform}
            onSuccess={() => setShowConnectionForm(false)}
            onCancel={() => setShowConnectionForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* VMX Uploader Dialog */}
      <Dialog open={showVMXUploader} onOpenChange={setShowVMXUploader}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload VMX CSV</DialogTitle>
            <DialogDescription>
              Upload your VMX CSV file to import customer data
            </DialogDescription>
          </DialogHeader>
          <VMXUploader onSuccess={() => setShowVMXUploader(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSPage;