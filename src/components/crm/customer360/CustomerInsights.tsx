import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Calendar, ShoppingCart, Star } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface CustomerInsightsProps {
  customer: {
    enriched_total_spent: number;
    order_count: number;
    avg_order_value: number | null;
    first_order_date: string | null;
    last_order_date: string | null;
    favorite_products: string | null;
    product_categories: string | null;
  };
}

export const CustomerInsights = ({ customer }: CustomerInsightsProps) => {
  // Mock data for charts - in a real app, this would come from API
  const productCategoryData = customer.product_categories 
    ? customer.product_categories.split(', ').slice(0, 5).map((category, index) => ({
        category,
        spent: Math.floor((customer.enriched_total_spent / customer.order_count) * (Math.random() * 0.5 + 0.5)),
      }))
    : [
        { category: 'Perennials', spent: 150 },
        { category: 'Annuals', spent: 120 },
        { category: 'Fertilizers', spent: 85 },
        { category: 'Tools', spent: 65 },
        { category: 'Seeds', spent: 45 },
      ];

  // Mock spending over time data
  const spendingOverTime = Array.from({ length: 12 }, (_, index) => ({
    month: new Date(2024, index).toLocaleDateString('en-US', { month: 'short' }),
    spent: Math.floor(Math.random() * 200 + 50),
  }));

  const topProducts = customer.favorite_products
    ? customer.favorite_products.split(', ').slice(0, 5).map((product, index) => ({
        name: product,
        purchases: Math.floor(Math.random() * 5 + 1),
        lastPurchase: `${Math.floor(Math.random() * 30 + 1)} days ago`,
      }))
    : [
        { name: 'Premium Rose Bush', purchases: 3, lastPurchase: '2 weeks ago' },
        { name: 'Organic Fertilizer', purchases: 5, lastPurchase: '1 month ago' },
        { name: 'Garden Hose 50ft', purchases: 1, lastPurchase: '3 months ago' },
        { name: 'Tulip Bulbs Mix', purchases: 2, lastPurchase: '6 months ago' },
        { name: 'Pruning Shears', purchases: 1, lastPurchase: '8 months ago' },
      ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Spending by Category */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Spending by Product Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productCategoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="category" 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip 
                formatter={(value) => [formatCurrency(value as number), 'Spent']}
                labelFormatter={(label) => `Category: ${label}`}
              />
              <Bar 
                dataKey="spent" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Spending Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Spending Trend (Last 12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={spendingOverTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip 
                formatter={(value) => [formatCurrency(value as number), 'Spent']}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="spent" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Top 5 Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.purchases} purchase{product.purchases !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Last bought</p>
                  <p className="text-sm font-medium">{product.lastPurchase}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Customer Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Customer Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div>
                <p className="text-sm text-emerald-700">Total Spent</p>
                <p className="text-2xl font-bold text-emerald-800">
                  {formatCurrency(customer.enriched_total_spent)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <p className="text-sm text-blue-700">Average Order Value</p>
                <p className="text-2xl font-bold text-blue-800">
                  {customer.avg_order_value 
                    ? formatCurrency(customer.avg_order_value)
                    : formatCurrency(customer.enriched_total_spent / Math.max(customer.order_count, 1))
                  }
                </p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-600" />
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div>
                <p className="text-sm text-purple-700">Total Orders</p>
                <p className="text-2xl font-bold text-purple-800">
                  {customer.order_count}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-purple-600" />
            </div>

            {customer.first_order_date && (
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div>
                  <p className="text-sm text-orange-700">Customer Since</p>
                  <p className="text-lg font-bold text-orange-800">
                    {new Date(customer.first_order_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long'
                    })}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-orange-600" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};