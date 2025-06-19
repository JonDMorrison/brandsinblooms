
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, Merge, Eye, Calendar, Coins } from "lucide-react";
import { useDuplicateManagement } from "@/hooks/useDuplicateManagement";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DuplicateAccount {
  user_id: string;
  created_at: string;
  onboarding_completed_at?: string;
  tokens_balance: number;
  company_name?: string;
  content_count: number;
  campaign_count: number;
}

interface DuplicateSuggestion {
  email: string;
  accounts: DuplicateAccount[];
  suggested_keep_user_id: string;
  suggestion_reason: string;
}

export const DuplicateManagementSection = () => {
  const [suggestions, setSuggestions] = useState<DuplicateSuggestion[]>([]);
  const { loading, mergingPair, getDuplicateSuggestions, mergeAccounts } = useDuplicateManagement();

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    const data = await getDuplicateSuggestions();
    setSuggestions(data);
  };

  const handleMerge = async (keepUserId: string, mergeUserId: string) => {
    const success = await mergeAccounts(keepUserId, mergeUserId);
    if (success) {
      await loadSuggestions(); // Refresh the list
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getAccountScore = (account: DuplicateAccount) => {
    let score = 0;
    if (account.onboarding_completed_at) score += 50;
    score += account.content_count * 10;
    score += account.campaign_count * 15;
    score += Math.min(account.tokens_balance, 100) / 10;
    return score;
  };

  if (loading && suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-garden-green-dark flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-gray-500" />
            Duplicate Account Management
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {suggestions.length > 0 
              ? `Found ${suggestions.length} groups of duplicate accounts`
              : "No duplicate accounts detected"
            }
          </p>
        </div>
        <Button onClick={loadSuggestions} disabled={loading} variant="outline">
          <Eye className="w-4 h-4 mr-2" />
          {loading ? 'Scanning...' : 'Refresh Scan'}
        </Button>
      </div>

      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-green-700 mb-2">All Clean!</h3>
            <p className="text-gray-600">No duplicate accounts found in the system.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <Card key={index} className="border-gray-200 bg-gray-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-gray-600" />
                    {suggestion.email}
                  </div>
                  <Badge variant="outline" className="bg-gray-100 text-gray-800">
                    {suggestion.accounts.length} accounts
                  </Badge>
                </CardTitle>
                <p className="text-sm text-gray-700">
                  <strong>Suggestion:</strong> {suggestion.suggestion_reason}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {suggestion.accounts.map((account, accountIndex) => {
                    const isRecommended = account.user_id === suggestion.suggested_keep_user_id;
                    const score = getAccountScore(account);
                    const isMerging = mergingPair?.keep === account.user_id || mergingPair?.merge === account.user_id;
                    
                    return (
                      <div 
                        key={accountIndex} 
                        className={`p-4 rounded-lg border-2 ${
                          isRecommended 
                            ? 'border-green-300 bg-green-50' 
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={isRecommended ? "default" : "secondary"}
                              className={isRecommended ? "bg-green-600" : ""}
                            >
                              {isRecommended ? "Recommended Keep" : `Account ${accountIndex + 1}`}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Score: {score}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            Created: {formatDate(account.created_at)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-3 h-3" />
                            Company: {account.company_name || 'Not set'}
                          </div>
                          <div className="flex items-center gap-2">
                            <Coins className="w-3 h-3" />
                            Tokens: {account.tokens_balance}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>Content: {account.content_count}</div>
                            <div>Campaigns: {account.campaign_count}</div>
                          </div>
                          <div className="text-xs">
                            Status: {account.onboarding_completed_at ? 'Onboarded' : 'Pending'}
                          </div>
                        </div>

                        {!isRecommended && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                className="w-full mt-3"
                                disabled={isMerging}
                              >
                                <Merge className="w-3 h-3 mr-1" />
                                {isMerging ? 'Merging...' : 'Merge into Recommended'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Merge Duplicate Account</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to merge this account into the recommended one?
                                  <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
                                    <strong>This will:</strong>
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                      <li>Move all campaigns, content, and data to the recommended account</li>
                                      <li>Combine token balances (keeping the higher amount)</li>
                                      <li>Merge profile information (keeping the most complete data)</li>
                                      <li>Permanently delete this duplicate account</li>
                                    </ul>
                                  </div>
                                  <div className="mt-3 p-3 bg-red-50 rounded text-sm text-red-800">
                                    <strong>Warning:</strong> This action cannot be undone.
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleMerge(suggestion.suggested_keep_user_id, account.user_id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Merge Account
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
