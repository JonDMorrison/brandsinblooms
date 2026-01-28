import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  X,
  CheckCircle,
  XCircle,
  Clock,
  Bot
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type SubmissionResultFilter = 'all' | 'accepted' | 'rejected_invalid' | 'rejected_rate_limited' | 'rejected_spam';

interface SubmissionFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultFilter: SubmissionResultFilter;
  onResultFilterChange: (filter: SubmissionResultFilter) => void;
  consentFilter: 'all' | 'email' | 'sms' | 'both' | 'none';
  onConsentFilterChange: (filter: 'all' | 'email' | 'sms' | 'both' | 'none') => void;
  activeFiltersCount: number;
  onClearFilters: () => void;
}

const resultOptions = [
  { value: 'all' as const, label: 'All Results', icon: null },
  { value: 'accepted' as const, label: 'Accepted', icon: <CheckCircle className="h-4 w-4 text-green-600" /> },
  { value: 'rejected_invalid' as const, label: 'Invalid', icon: <XCircle className="h-4 w-4 text-destructive" /> },
  { value: 'rejected_rate_limited' as const, label: 'Rate Limited', icon: <Clock className="h-4 w-4 text-yellow-600" /> },
  { value: 'rejected_spam' as const, label: 'Spam', icon: <Bot className="h-4 w-4 text-destructive" /> },
];

const consentOptions = [
  { value: 'all' as const, label: 'All Consent States' },
  { value: 'email' as const, label: 'Email Consent Only' },
  { value: 'sms' as const, label: 'SMS Consent Only' },
  { value: 'both' as const, label: 'Both Consents' },
  { value: 'none' as const, label: 'No Consent' },
];

export function SubmissionFilters({
  searchQuery,
  onSearchChange,
  resultFilter,
  onResultFilterChange,
  consentFilter,
  onConsentFilterChange,
  activeFiltersCount,
  onClearFilters,
}: SubmissionFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by email..."
          className="pl-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => onSearchChange('')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Result Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Status
            {resultFilter !== 'all' && (
              <Badge variant="secondary" className="ml-1 text-xs">
                1
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-background">
          <DropdownMenuLabel>Filter by Result</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {resultOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onResultFilterChange(option.value)}
              className={resultFilter === option.value ? 'bg-muted' : ''}
            >
              <div className="flex items-center gap-2">
                {option.icon}
                <span>{option.label}</span>
              </div>
              {resultFilter === option.value && (
                <CheckCircle className="h-4 w-4 ml-auto text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Consent Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            Consent
            {consentFilter !== 'all' && (
              <Badge variant="secondary" className="ml-1 text-xs">
                1
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-background">
          <DropdownMenuLabel>Filter by Consent</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {consentOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onConsentFilterChange(option.value)}
              className={consentFilter === option.value ? 'bg-muted' : ''}
            >
              <span>{option.label}</span>
              {consentFilter === option.value && (
                <CheckCircle className="h-4 w-4 ml-auto text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Filters */}
      {activeFiltersCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear ({activeFiltersCount})
        </Button>
      )}
    </div>
  );
}
