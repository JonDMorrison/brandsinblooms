import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Link as LinkIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TopLinksTableProps {
  campaignId: string;
  delivered?: number;
  compact?: boolean;
  limit?: number;
}

interface LinkStats {
  link_id: string;
  url: string;
  clicks: number;
}

export const TopLinksTable: React.FC<TopLinksTableProps> = ({ 
  campaignId, 
  delivered = 0,
  compact = false,
  limit = 5
}) => {
  const { data: links, isLoading } = useQuery({
    queryKey: ['top-links', campaignId, limit],
    queryFn: async () => {
      // Get click events with link_id
      const { data: clickEvents, error } = await supabase
        .from('email_tracking_events')
        .select('link_id')
        .eq('campaign_id', campaignId)
        .eq('event_type', 'click')
        .not('link_id', 'is', null);

      if (error) throw error;

      // Count clicks per link
      const linkCounts: Record<string, number> = {};
      clickEvents?.forEach(event => {
        if (event.link_id) {
          linkCounts[event.link_id] = (linkCounts[event.link_id] || 0) + 1;
        }
      });

      // Get link URLs
      const linkIds = Object.keys(linkCounts);
      if (linkIds.length === 0) return [];

      const { data: trackedLinks, error: linksError } = await supabase
        .from('tracked_links')
        .select('id, url')
        .in('id', linkIds);

      if (linksError) throw linksError;

      // Combine and sort
      const linkStats: LinkStats[] = (trackedLinks || []).map(link => ({
        link_id: link.id,
        url: link.url,
        clicks: linkCounts[link.id] || 0,
      }));

      return linkStats
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, limit);
    },
    enabled: !!campaignId,
    staleTime: 60000,
  });

  // Extract domain from URL for display
  const getDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url.slice(0, 30);
    }
  };

  // Truncate URL for display
  const truncateUrl = (url: string, maxLength = 50): string => {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!links || links.length === 0) {
    return (
      <Card>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <CardTitle className={compact ? 'text-base flex items-center gap-2' : 'flex items-center gap-2'}>
            <LinkIcon className="h-4 w-4" />
            Top Links
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 text-center text-muted-foreground text-sm">
          No link clicks recorded yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <CardTitle className={compact ? 'text-base flex items-center gap-2' : 'flex items-center gap-2'}>
          <LinkIcon className="h-4 w-4" />
          Top Links
          <Badge variant="secondary" className="ml-2 text-xs">
            {links.length} tracked
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? 'pt-0' : ''}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={compact ? 'py-1' : ''}>URL</TableHead>
              <TableHead className={compact ? 'py-1 text-right w-20' : 'text-right w-24'}>Clicks</TableHead>
              <TableHead className={compact ? 'py-1 text-right w-16' : 'text-right w-20'}>CTR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link, idx) => {
              const ctr = delivered > 0 
                ? ((link.clicks / delivered) * 100).toFixed(2)
                : '0.00';
              
              return (
                <TableRow key={link.link_id || idx}>
                  <TableCell className={compact ? 'py-1.5' : ''}>
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline text-sm"
                      title={link.url}
                    >
                      {compact ? getDomain(link.url) : truncateUrl(link.url)}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className={compact ? 'py-1.5 text-right font-medium' : 'text-right font-medium'}>
                    {link.clicks.toLocaleString()}
                  </TableCell>
                  <TableCell className={compact ? 'py-1.5 text-right' : 'text-right'}>
                    <Badge variant="outline" className="text-xs">
                      {ctr}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TopLinksTable;
