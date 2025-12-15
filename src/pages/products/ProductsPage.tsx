import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Package, MoreHorizontal, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { useProducts, useProductMutations } from '@/hooks/useProducts';
import { ProductFilters, ProductSource, ProductStatus } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/NativeSelect';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { HeadlineMedium, BodySmall, Caption } from '@/components/ui/typography';

const SOURCE_LABELS: Record<ProductSource, string> = {
  platform: 'Platform',
  square: 'Square',
  stripe: 'Stripe',
  shopify: 'Shopify',
  lightspeed: 'Lightspeed',
  import: 'Import',
};

const SOURCE_COLORS: Record<ProductSource, string> = {
  platform: 'bg-primary/10 text-primary',
  square: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  stripe: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  shopify: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  lightspeed: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  import: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const STATUS_COLORS: Record<ProductStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'platform', label: 'Platform' },
  { value: 'square', label: 'Square' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'lightspeed', label: 'Lightspeed' },
  { value: 'import', label: 'Import' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const PAGE_SIZE_OPTIONS = [
  { value: '12', label: '12 per page' },
  { value: '24', label: '24 per page' },
  { value: '48', label: '48 per page' },
];

export default function ProductsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    source: 'all',
    status: 'all',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  
  const { data, isLoading } = useProducts({
    ...filters,
    page: currentPage,
    pageSize,
  });
  const { deleteProduct } = useProductMutations();
  
  const products = data?.products;
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  
  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setCurrentPage(1);
  };
  
  const handleSourceChange = (value: string) => {
    setFilters((prev) => ({ ...prev, source: value as ProductSource | 'all' }));
    setCurrentPage(1);
  };
  
  const handleStatusChange = (value: string) => {
    setFilters((prev) => ({ ...prev, status: value as ProductStatus | 'all' }));
    setCurrentPage(1);
  };
  
  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not focused on an input
      if (document.activeElement?.tagName === 'INPUT') return;
      
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage((p) => p - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        setCurrentPage((p) => p + 1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);
  
  const handleDelete = async () => {
    if (deleteProductId) {
      await deleteProduct.mutateAsync(deleteProductId);
      setDeleteProductId(null);
    }
  };
  
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(price);
  };
  
  // Smart pagination items generator
  const getPaginationItems = () => {
    const items: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(i);
      }
    } else {
      if (currentPage <= 3) {
        items.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        items.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        items.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    
    return items;
  };
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <HeadlineMedium>Products</HeadlineMedium>
          <BodySmall className="text-muted-foreground mt-1">
            Manage your product catalog across all channels {totalCount > 0 && `(${totalCount.toLocaleString()} total)`}
          </BodySmall>
        </div>
        <Button onClick={() => navigate('/products/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <NativeSelect
          options={SOURCE_OPTIONS}
          value={filters.source || 'all'}
          onChange={(e) => handleSourceChange(e.target.value)}
          className="w-[160px]"
        />
        <NativeSelect
          options={STATUS_OPTIONS}
          value={filters.status || 'all'}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-[140px]"
        />
      </div>
      
      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: pageSize > 12 ? 12 : pageSize }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="aspect-square rounded-lg mb-3" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-sm">
              Create your first product or sync from your connected integrations.
            </p>
            <Button onClick={() => navigate('/products/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products?.map((product) => (
              <Card 
                key={product.id} 
                className="group hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/products/${product.id}`)}
              >
                <CardContent className="p-4">
                  {/* Product Image Placeholder */}
                  <div className="aspect-square rounded-lg bg-muted mb-3 flex items-center justify-center overflow-hidden">
                    <Package className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                  
                  {/* Product Info */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium line-clamp-2 flex-1">{product.name}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/products/${product.id}`);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {product.external_id && (
                            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View in {SOURCE_LABELS[product.source]}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteProductId(product.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-lg">
                        {formatPrice(product.price, product.currency)}
                      </span>
                      {product.sku && (
                        <Caption className="text-muted-foreground">
                          SKU: {product.sku}
                        </Caption>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className={SOURCE_COLORS[product.source]}>
                        {SOURCE_LABELS[product.source]}
                      </Badge>
                      <Badge variant="secondary" className={STATUS_COLORS[product.status]}>
                        {product.status}
                      </Badge>
                    </div>
                    
                    {product.track_inventory && (
                      <Caption className={
                        product.inventory_count <= product.low_stock_threshold
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }>
                        {product.inventory_count} in stock
                      </Caption>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} products
                </span>
                <NativeSelect
                  options={PAGE_SIZE_OPTIONS}
                  value={pageSize.toString()}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="w-[130px]"
                />
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {getPaginationItems().map((item, index) => (
                    <PaginationItem key={index}>
                      {item === '...' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => setCurrentPage(item as number)}
                          isActive={currentPage === item}
                          className="cursor-pointer"
                        >
                          {item}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
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
    </div>
  );
}
