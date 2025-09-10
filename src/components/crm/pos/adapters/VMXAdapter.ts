import { POSAdapter, NormalizedCustomer, NormalizedOrder, TestConnectionResult, SyncOptions, PaginatedResult } from './POSAdapter';

export class VMXAdapter extends POSAdapter {
  // VMX doesn't have an API, so we work with CSV data directly
  protected rateLimit = 0; // No rate limiting for CSV processing
  
  async testConnection(csvData: any[]): Promise<TestConnectionResult> {
    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return {
        success: false,
        message: 'No valid CSV data provided'
      };
    }
    
    // Check if CSV has required fields
    const sampleRow = csvData[0];
    const hasEmail = 'email' in sampleRow;
    const hasName = 'name' in sampleRow || ('first_name' in sampleRow && 'last_name' in sampleRow);
    
    if (!hasEmail || !hasName) {
      return {
        success: false,
        message: 'CSV must contain email and name fields'
      };
    }
    
    return {
      success: true,
      message: `Successfully validated CSV with ${csvData.length} rows`,
      details: { rowCount: csvData.length, sampleFields: Object.keys(sampleRow) }
    };
  }
  
  async fetchCustomers(csvData: any[], options?: SyncOptions): Promise<PaginatedResult<any>> {
    const pageLimit = options?.pageLimit || csvData.length;
    const startIndex = options?.cursor ? parseInt(options.cursor) : 0;
    const endIndex = Math.min(startIndex + pageLimit, csvData.length);
    
    return {
      data: csvData.slice(startIndex, endIndex),
      nextCursor: endIndex < csvData.length ? endIndex.toString() : undefined,
      hasMore: endIndex < csvData.length
    };
  }

  async fetchOrders(csvData: any[], options?: SyncOptions): Promise<PaginatedResult<any>> {
    const pageLimit = options?.pageLimit || csvData.length;
    const startIndex = options?.cursor ? parseInt(options.cursor) : 0;
    const endIndex = Math.min(startIndex + pageLimit, csvData.length);
    
    return {
      data: csvData.slice(startIndex, endIndex),
      nextCursor: endIndex < csvData.length ? endIndex.toString() : undefined,
      hasMore: endIndex < csvData.length
    };
  }

  async fetchProducts(csvData: any[], options?: SyncOptions): Promise<PaginatedResult<any>> {
    const pageLimit = options?.pageLimit || csvData.length;
    const startIndex = options?.cursor ? parseInt(options.cursor) : 0;
    const endIndex = Math.min(startIndex + pageLimit, csvData.length);
    
    return {
      data: csvData.slice(startIndex, endIndex),
      nextCursor: endIndex < csvData.length ? endIndex.toString() : undefined,
      hasMore: endIndex < csvData.length
    };
  }

  adaptCustomers(csvData: any[]): NormalizedCustomer[] {
    return csvData.map(row => ({
      name: row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      email: row.email,
      phone: row.phone || row.phone_number,
      pos_source: 'vmx',
      tags: row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : [],
      external_id: row.customer_id || row.id,
    }));
  }

  adaptOrders(csvData: any[]): NormalizedOrder[] {
    return csvData
      .filter(row => row.product && row.date && row.amount)
      .map((row, index) => ({
        order_id: row.order_id || `vmx_${Date.now()}_${index}`,
        customer_email: row.email,
        date: row.date,
        total: parseFloat(row.amount) || 0,
        currency: row.currency || 'USD',
        external_customer_id: row.customer_id || row.id,
        items: [
          {
            name: row.product || row.product_name,
            category: row.category || row.product_category || 'General',
            quantity: parseInt(row.quantity) || 1,
            price: parseFloat(row.amount) || 0,
          }
        ],
      }));
  }

  // Override syncData for VMX since it's CSV-based
  async syncData(csvData: any[]): Promise<{ customers: NormalizedCustomer[]; orders: NormalizedOrder[] }> {
    return {
      customers: this.adaptCustomers(csvData),
      orders: this.adaptOrders(csvData)
    };
  }
}