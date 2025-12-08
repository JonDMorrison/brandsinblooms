import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Plus, GripVertical, Image as ImageIcon, Sparkles, Upload, Star, X } from 'lucide-react';
import { useProduct, useProductMutations, useProductVariations, useProductImages } from '@/hooks/useProducts';
import { supabase } from '@/integrations/supabase/client';
import { ProductFormData } from '@/types/product';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NativeSelect } from '@/components/ui/NativeSelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { HeadlineMedium, BodySmall } from '@/components/ui/typography';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const isNew = productId === 'new';
  
  const { data: product, isLoading } = useProduct(isNew ? undefined : productId);
  const { createProduct, updateProduct, deleteProduct } = useProductMutations();
  const { createVariation, deleteVariation } = useProductVariations(productId);
  const { deleteImage, setPrimaryImage } = useProductImages(productId);
  
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    sku: '',
    barcode: '',
    price: 0,
    cost_price: undefined,
    compare_at_price: undefined,
    currency: 'USD',
    inventory_count: 0,
    track_inventory: true,
    low_stock_threshold: 5,
    category: '',
    subcategory: '',
    tags: [],
    status: 'draft',
    is_visible: true,
    meta_title: '',
    meta_description: '',
  });
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showVariationDialog, setShowVariationDialog] = useState(false);
  const [newVariation, setNewVariation] = useState({ name: '', sku: '', price: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { addImage } = useProductImages(productId);
  
  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !productId) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    
    setIsUploadingImage(true);
    
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      
      // Add image record to database
      await addImage.mutateAsync({
        product_id: productId,
        image_url: urlData.publicUrl,
        alt_text: file.name,
        source: 'upload',
        is_primary: product?.images?.length === 0,
        sort_order: (product?.images?.length || 0) + 1,
      });
      
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload image: ${error.message}`);
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Populate form when product loads
  useEffect(() => {
    if (product && !isNew) {
      setFormData({
        name: product.name,
        description: product.description || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        price: product.price,
        cost_price: product.cost_price,
        compare_at_price: product.compare_at_price,
        currency: product.currency,
        inventory_count: product.inventory_count,
        track_inventory: product.track_inventory,
        low_stock_threshold: product.low_stock_threshold,
        category: product.category || '',
        subcategory: product.subcategory || '',
        tags: product.tags || [],
        status: product.status,
        is_visible: product.is_visible,
        meta_title: product.meta_title || '',
        meta_description: product.meta_description || '',
      });
    }
  }, [product, isNew]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      if (isNew) {
        const created = await createProduct.mutateAsync(formData);
        navigate(`/products/${created.id}`);
      } else if (productId) {
        await updateProduct.mutateAsync({ id: productId, data: formData });
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (productId) {
      await deleteProduct.mutateAsync(productId);
      navigate('/products');
    }
  };
  
  const handleAddVariation = async () => {
    if (productId && newVariation.name) {
      await createVariation.mutateAsync({
        product_id: productId,
        name: newVariation.name,
        sku: newVariation.sku || undefined,
        price: newVariation.price || undefined,
        inventory_count: 0,
        attributes: {},
        is_active: true,
        sort_order: (product?.variations?.length || 0) + 1,
      });
      setNewVariation({ name: '', sku: '', price: 0 });
      setShowVariationDialog(false);
    }
  };
  
  if (isLoading && !isNew) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/products')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <HeadlineMedium>{isNew ? 'New Product' : product?.name}</HeadlineMedium>
            {!isNew && product?.source !== 'platform' && (
              <BodySmall className="text-muted-foreground">
                Synced from {product?.source}
              </BodySmall>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="outline" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : isNew ? 'Create Product' : 'Save Changes'}
          </Button>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter product name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your product..."
                    rows={4}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="SKU-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="123456789"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compare_at_price">Compare at Price</Label>
                    <Input
                      id="compare_at_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.compare_at_price || ''}
                      onChange={(e) => setFormData({ ...formData, compare_at_price: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost_price">Cost Price</Label>
                    <Input
                      id="cost_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost_price || ''}
                      onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || undefined })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Inventory */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Track Inventory</Label>
                    <BodySmall className="text-muted-foreground">
                      Keep track of stock levels
                    </BodySmall>
                  </div>
                  <Switch
                    checked={formData.track_inventory}
                    onCheckedChange={(checked) => setFormData({ ...formData, track_inventory: checked })}
                  />
                </div>
                
                {formData.track_inventory && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inventory_count">Quantity in Stock</Label>
                      <Input
                        id="inventory_count"
                        type="number"
                        min="0"
                        value={formData.inventory_count}
                        onChange={(e) => setFormData({ ...formData, inventory_count: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="low_stock_threshold">Low Stock Alert</Label>
                      <Input
                        id="low_stock_threshold"
                        type="number"
                        min="0"
                        value={formData.low_stock_threshold}
                        onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Variations (only for existing products) */}
            {!isNew && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Variations</CardTitle>
                    <CardDescription>Add size, color, or other variants</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowVariationDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variation
                  </Button>
                </CardHeader>
                <CardContent>
                  {product?.variations?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BodySmall>No variations yet. Add variations like size or color.</BodySmall>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {product?.variations?.map((variation) => (
                        <div
                          key={variation.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{variation.name}</p>
                              {variation.sku && (
                                <BodySmall className="text-muted-foreground">SKU: {variation.sku}</BodySmall>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {variation.price && (
                              <span className="font-medium">${variation.price.toFixed(2)}</span>
                            )}
                            <Badge variant="secondary">{variation.inventory_count} in stock</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteVariation.mutate(variation.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Product Status</Label>
                  <NativeSelect
                    options={STATUS_OPTIONS}
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'draft' | 'active' | 'archived' })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>Visible on Store</Label>
                  <Switch
                    checked={formData.is_visible}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Images (only for existing products) */}
            {!isNew && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Images</CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploadingImage ? 'Uploading...' : 'Upload'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {product?.images?.length === 0 ? (
                    <div className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mb-2" />
                      <BodySmall>No images yet</BodySmall>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {product?.images?.map((image) => (
                        <div key={image.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                          {image.image_url ? (
                            <img
                              src={image.image_url}
                              alt={image.alt_text || 'Product image'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8"
                              onClick={() => setPrimaryImage.mutate(image.id)}
                            >
                              <Star className={`h-4 w-4 ${image.is_primary ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8"
                              onClick={() => deleteImage.mutate(image.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          {image.is_primary && (
                            <Badge className="absolute top-2 left-2 bg-yellow-500">Primary</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Category */}
            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Plants, Tools"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Subcategory</Label>
                  <Input
                    id="subcategory"
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    placeholder="e.g., Indoor, Outdoor"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
      
      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{product?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Add Variation Dialog */}
      <Dialog open={showVariationDialog} onOpenChange={setShowVariationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Variation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variation-name">Variation Name *</Label>
              <Input
                id="variation-name"
                value={newVariation.name}
                onChange={(e) => setNewVariation({ ...newVariation, name: e.target.value })}
                placeholder="e.g., Large, Red"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="variation-sku">SKU</Label>
                <Input
                  id="variation-sku"
                  value={newVariation.sku}
                  onChange={(e) => setNewVariation({ ...newVariation, sku: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variation-price">Price Override</Label>
                <Input
                  id="variation-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newVariation.price || ''}
                  onChange={(e) => setNewVariation({ ...newVariation, price: parseFloat(e.target.value) || 0 })}
                  placeholder="Leave empty to use product price"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVariationDialog(false)}>Cancel</Button>
            <Button onClick={handleAddVariation} disabled={!newVariation.name}>Add Variation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
