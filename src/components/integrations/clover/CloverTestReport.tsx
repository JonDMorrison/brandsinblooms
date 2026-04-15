import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Button } from '@/components/ui-legacy/button';
import { Badge } from '@/components/ui-legacy/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui-legacy/collapsible';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight,
  Copy,
  RefreshCw,
  Clock,
  Store,
  Users,
  UserCircle,
  Package,
  ShoppingCart,
  CreditCard,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface EndpointResult {
  success: boolean;
  count?: number;
  samples?: any[];
  data?: any;
  error?: string;
  timing_ms: number;
  status_code?: number;
}

interface TestReport {
  status: 'success' | 'partial' | 'failed';
  summary: string;
  duration_ms: number;
  results: {
    merchant: EndpointResult;
    employees: EndpointResult;
    customers: EndpointResult;
    inventory: EndpointResult;
    orders: EndpointResult;
    payments: EndpointResult;
  };
  counts: {
    employees: number;
    customers: number;
    items: number;
    orders_last_30d: number;
    payments_last_30d: number;
  };
  errors: Array<{ endpoint: string; code: string; message: string }>;
}

interface CloverTestReportProps {
  report: TestReport;
  testedAt?: string;
  onRerun: () => void;
  isRunning?: boolean;
}

const StatusIcon = ({ success }: { success: boolean }) => {
  if (success) {
    return <CheckCircle className="h-5 w-5 text-green-600" />;
  }
  return <XCircle className="h-5 w-5 text-red-600" />;
};

const CategoryCard = ({ 
  name, 
  icon: Icon, 
  result, 
  count 
}: { 
  name: string; 
  icon: React.ElementType; 
  result: EndpointResult;
  count?: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasSamples = result.samples && result.samples.length > 0;
  const hasData = result.data && Object.keys(result.data).length > 0;

  return (
    <Card className="bg-muted/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{name}</span>
              </div>
              <div className="flex items-center gap-2">
                {result.success && count !== undefined && (
                  <Badge variant="secondary" className="text-xs">
                    {count}
                  </Badge>
                )}
                <StatusIcon success={result.success} />
                {(hasSamples || hasData) && (
                  isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </div>
            {!result.success && result.error && (
              <p className="text-xs text-red-600 mt-1 truncate">{result.error}</p>
            )}
            <p className="text-xs text-muted-foreground">{result.timing_ms}ms</p>
          </CardHeader>
        </CollapsibleTrigger>
        
        {(hasSamples || hasData) && (
          <CollapsibleContent>
            <CardContent className="p-3 pt-0">
              {hasData && (
                <div className="bg-background rounded p-2 text-xs">
                  <pre className="whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
              {hasSamples && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Sample Records:</p>
                  {result.samples!.map((sample, idx) => (
                    <div key={idx} className="bg-background rounded p-2 text-xs">
                      <pre className="whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(sample, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        )}
      </Collapsible>
    </Card>
  );
};

export const CloverTestReport = ({ report, testedAt, onRerun, isRunning }: CloverTestReportProps) => {
  const { toast } = useToast();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    toast({ title: 'Copied to clipboard', description: 'Test report JSON copied' });
  };

  const getStatusBadge = () => {
    switch (report.status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            All Tests Passed
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Partial Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Tests Failed
          </Badge>
        );
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Connection Test Results</CardTitle>
            {getStatusBadge()}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {testedAt ? formatDistanceToNow(new Date(testedAt), { addSuffix: true }) : 'Just now'}
            <span className="text-muted-foreground">• {report.duration_ms}ms</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{report.summary}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Category Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <CategoryCard 
            name="Merchant" 
            icon={Store} 
            result={report.results.merchant} 
          />
          <CategoryCard 
            name="Employees" 
            icon={UserCircle} 
            result={report.results.employees}
            count={report.counts.employees}
          />
          <CategoryCard 
            name="Customers" 
            icon={Users} 
            result={report.results.customers}
            count={report.counts.customers}
          />
          <CategoryCard 
            name="Inventory" 
            icon={Package} 
            result={report.results.inventory}
            count={report.counts.items}
          />
          <CategoryCard 
            name="Orders (30d)" 
            icon={ShoppingCart} 
            result={report.results.orders}
            count={report.counts.orders_last_30d}
          />
          <CategoryCard 
            name="Payments (30d)" 
            icon={CreditCard} 
            result={report.results.payments}
            count={report.counts.payments_last_30d}
          />
        </div>

        {/* Errors Section */}
        {report.errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
              Errors ({report.errors.length})
            </h4>
            <div className="space-y-1">
              {report.errors.map((error, idx) => (
                <div key={idx} className="text-xs text-red-700 dark:text-red-300">
                  <span className="font-medium">{error.endpoint}:</span> [{error.code}] {error.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={onRerun} 
            disabled={isRunning}
            size="sm" 
            variant="outline"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Re-run Test
          </Button>
          <Button 
            onClick={copyToClipboard}
            size="sm" 
            variant="ghost"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
