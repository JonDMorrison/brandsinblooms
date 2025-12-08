export type ProductSource = 'platform' | 'square' | 'stripe' | 'shopify' | 'lightspeed' | 'import';
export type ProductStatus = 'active' | 'draft' | 'archived';
export type ProductImageSource = 'upload' | 'ai_generated' | 'external' | 'square' | 'shopify' | 'stripe';

export interface Product {
  id: string;
  tenant_id: string;
  created_by_user_id?: string;
  
  // Basic info
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  
  // Pricing
  price: number;
  cost_price?: number;
  compare_at_price?: number;
  currency: string;
  
  // Inventory
  inventory_count: number;
  track_inventory: boolean;
  low_stock_threshold: number;
  
  // Categorization
  category?: string;
  subcategory?: string;
  tags: string[];
  
  // Source tracking
  source: ProductSource;
  external_id?: string;
  external_data?: Record<string, unknown>;
  last_synced_at?: string;
  
  // Status
  status: ProductStatus;
  is_visible: boolean;
  
  // SEO
  slug?: string;
  meta_title?: string;
  meta_description?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Relations (when joined)
  variations?: ProductVariation[];
  images?: ProductImage[];
}

export interface ProductVariation {
  id: string;
  product_id: string;
  
  name: string;
  sku?: string;
  barcode?: string;
  
  price?: number;
  cost_price?: number;
  compare_at_price?: number;
  
  inventory_count: number;
  
  attributes: Record<string, string>;
  
  external_id?: string;
  
  is_active: boolean;
  sort_order: number;
  
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  variation_id?: string;
  
  global_image_id?: string;
  image_url?: string;
  thumbnail_url?: string;
  
  alt_text?: string;
  sort_order: number;
  is_primary: boolean;
  
  source: ProductImageSource;
  
  created_at: string;
}

export interface ProductFilters {
  search?: string;
  source?: ProductSource | 'all';
  status?: ProductStatus | 'all';
  category?: string;
}

export interface ProductFormData {
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost_price?: number;
  compare_at_price?: number;
  currency: string;
  inventory_count: number;
  track_inventory: boolean;
  low_stock_threshold: number;
  category?: string;
  subcategory?: string;
  tags: string[];
  status: ProductStatus;
  is_visible: boolean;
  meta_title?: string;
  meta_description?: string;
}
