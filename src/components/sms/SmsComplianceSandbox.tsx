import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Shield, ChevronDown, ChevronUp, Phone, MessageSquare, Check, X, HelpCircle } from 'lucide-react';

interface ComplianceState {
  smsOptIn: boolean;
  optOut: boolean;
}

const COMPLIANCE_RESPONSES = {
  STOP: {
    message: "You have been unsubscribed from SMS messages. Reply START to opt back in.",
    description: "Customer will be marked as opted-out and will not receive future marketing SMS.",
  },
  START: {
    message: "You have been subscribed to SMS messages. Reply STOP to unsubscribe at any time.",
    description: "Customer will be re-subscribed and eligible to receive SMS campaigns.",
  },
  HELP: {
    message: "Reply STOP to unsubscribe from SMS messages. For assistance, contact support@yourcompany.com",
    description: "Customer receives help information without changing their subscription status.",
  },
};

export const SmsComplianceSandbox: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<ComplianceState>({
    smsOptIn: true,
    optOut: false,
  });
  const [lastAction, setLastAction] = useState<'STOP' | 'START' | 'HELP' | null>(null);
  const [showResponse, setShowResponse] = useState(false);

  const simulateKeyword = (keyword: 'STOP' | 'START' | 'HELP') => {
    setLastAction(keyword);
    setShowResponse(true);

    if (keyword === 'STOP') {
      setState({ smsOptIn: false, optOut: true });
    } else if (keyword === 'START') {
      setState({ smsOptIn: true, optOut: false });
    }
    // HELP doesn't change state
  };

  const resetState = () => {
    setState({ smsOptIn: true, optOut: false });
    setLastAction(null);
    setShowResponse(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-t pt-3">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full text-left hover:bg-muted/50 p-2 rounded-md transition-colors">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4 text-primary" />
              Compliance Sandbox
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="pt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Simulate STOP/START/HELP keywords to understand how BloomSuite handles SMS compliance.
            <span className="block mt-1 text-amber-600 dark:text-amber-400">
              ⚠️ This is a simulation only - no real messages are sent.
            </span>
          </p>

          {/* Current State */}
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="text-xs font-medium">Current Customer State:</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">SMS Opt-In:</span>
                {state.smsOptIn ? (
                  <Badge variant="default" className="text-xs h-5">
                    <Check className="h-3 w-3 mr-1" /> Yes
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs h-5">
                    <X className="h-3 w-3 mr-1" /> No
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Opted Out:</span>
                {state.optOut ? (
                  <Badge variant="destructive" className="text-xs h-5">
                    <X className="h-3 w-3 mr-1" /> Yes
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs h-5">
                    No
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-xs">
              {state.smsOptIn && !state.optOut ? (
                <span className="text-green-600 dark:text-green-400">✓ Customer will receive SMS campaigns</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">✗ Customer will NOT receive SMS campaigns</span>
              )}
            </div>
          </div>

          {/* Simulation Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => simulateKeyword('STOP')}
              className="text-xs"
            >
              <Phone className="h-3 w-3 mr-1" />
              Simulate STOP
            </Button>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => simulateKeyword('START')}
              className="text-xs"
            >
              <Phone className="h-3 w-3 mr-1" />
              Simulate START
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => simulateKeyword('HELP')}
              className="text-xs"
            >
              <HelpCircle className="h-3 w-3 mr-1" />
              Simulate HELP
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={resetState}
              className="text-xs"
            >
              Reset
            </Button>
          </div>

          {/* Response Preview */}
          {showResponse && lastAction && (
            <div className="space-y-2">
              <div className="text-xs font-medium flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Auto-Response Sent:
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  "{COMPLIANCE_RESPONSES[lastAction].message}"
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  {COMPLIANCE_RESPONSES[lastAction].description}
                </p>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <strong>How it works in production:</strong>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>Customers reply STOP to any SMS to opt out</li>
              <li>Reply START or YES to opt back in</li>
              <li>Reply HELP for assistance information</li>
              <li>All compliance events are logged for auditing</li>
            </ul>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
