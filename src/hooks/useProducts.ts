import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product, ProductFilters, ProductFormData, ProductVariation, ProductImage } from '@/types/product';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useProducts(filters?: ProductFilters) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
      }
      
      if (filters?.source && filters.source !== 'all') {
        query = query.eq('source', filters.source);
      }
      
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });
}

export function useProduct(productId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId) return null;
      
      // Fetch product with variations and images
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();
      
      if (error) throw error;
      
      // Fetch variations
      const { data: variations } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');
      
      // Fetch images
      const { data: images } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');
      
      return {
        ...product,
        variations: variations || [],
        images: images || [],
      } as Product;
    },
    enabled: !!user && !!productId,
  });
}

export function useProductMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const createProduct = useMutation({
    mutationFn: async (data: ProductFormData) => {
      // Get user's tenant_id
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();
      
      if (!userData?.tenant_id) {
        throw new Error('No tenant found');
      }
      
      const { data: product, error } = await supabase
        .from('products')
        .insert({
          ...data,
          tenant_id: userData.tenant_id,
          created_by_user_id: user?.id,
          source: 'platform',
        })
        .select()
        .single();
      
      if (error) throw error;
      return product as Product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create product: ${error.message}`);
    },
  });
  
  const updateProduct = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductFormData> }) => {
      const { data: product, error } = await supabase
        .from('products')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return product as Product;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] });
      toast.success('Product updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update product: ${error.message}`);
    },
  });
  
  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete product: ${error.message}`);
    },
  });
  
  return { createProduct, updateProduct, deleteProduct };
}

export function useProductVariations(productId: string | undefined) {
  const queryClient = useQueryClient();
  
  const createVariation = useMutation({
    mutationFn: async (data: Omit<ProductVariation, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: variation, error } = await supabase
        .from('product_variations')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return variation as ProductVariation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      toast.success('Variation added');
    },
  });
  
  const updateVariation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductVariation> }) => {
      const { data: variation, error } = await supabase
        .from('product_variations')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return variation as ProductVariation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
  
  const deleteVariation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_variations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      toast.success('Variation deleted');
    },
  });
  
  return { createVariation, updateVariation, deleteVariation };
}

export function useProductImages(productId: string | undefined) {
  const queryClient = useQueryClient();
  
  const addImage = useMutation({
    mutationFn: async (data: Omit<ProductImage, 'id' | 'created_at'>) => {
      const { data: image, error } = await supabase
        .from('product_images')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return image as ProductImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
  
  const updateImage = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProductImage> }) => {
      const { data: image, error } = await supabase
        .from('product_images')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return image as ProductImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
  
  const deleteImage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
    },
  });
  
  const setPrimaryImage = useMutation({
    mutationFn: async (imageId: string) => {
      // First, unset all primary images for this product
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId!);
      
      // Then set the selected image as primary
      const { error } = await supabase
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', imageId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      toast.success('Primary image updated');
    },
  });
  
  return { addImage, updateImage, deleteImage, setPrimaryImage };
}
