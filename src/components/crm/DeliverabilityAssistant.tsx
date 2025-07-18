
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';

interface DeliverabilityScore {
  score: number;
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }>;
  recommendations: string[];
}

interface DeliverabilityAssistantProps {
  subject: string;
  content: string;
  senderName?: string;
  preheader?: string;
}

export const DeliverabilityAssistant = ({ 
  subject, 
  content, 
  senderName,
  preheader 
}: DeliverabilityAssistantProps) => {
  const [score, setScore] = useState<DeliverabilityScore>({ score: 0, issues: [], recommendations: [] });

  const analyzeContent = (subject: string, content: string, senderName?: string, preheader?: string) => {
    const issues: DeliverabilityScore['issues'] = [];
    const recommendations: string[] = [];
    let scoreDeductions = 0;

    // Subject line analysis
    if (subject.length === 0) {
      issues.push({
        type: 'error',
        message: 'Subject line is empty',
        suggestion: 'Add a compelling subject line to improve open rates'
      });
      scoreDeductions += 30;
    } else {
      if (subject.length > 50) {
        issues.push({
          type: 'warning',
          message: 'Subject line is too long (over 50 characters)',
          suggestion: 'Keep subject lines under 50 characters for better mobile display'
        });
        scoreDeductions += 10;
      }
      
      if (subject.match(/[!]{2,}|[?]{2,}/)) {
        issues.push({
          type: 'warning',
          message: 'Multiple exclamation marks or question marks detected',
          suggestion: 'Use punctuation sparingly to avoid spam filters'
        });
        scoreDeductions += 15;
      }

      const spamWords = ['FREE', 'URGENT', 'ACT NOW', 'LIMITED TIME', 'CLICK HERE', 'BUY NOW'];
      const foundSpamWords = spamWords.filter(word => subject.toUpperCase().includes(word));
      if (foundSpamWords.length > 0) {
        issues.push({
          type: 'warning',
          message: `Potential spam words detected: ${foundSpamWords.join(', ')}`,
          suggestion: 'Consider using alternative wording to improve deliverability'
        });
        scoreDeductions += foundSpamWords.length * 10;
      }

      if (subject === subject.toUpperCase() && subject.length > 10) {
        issues.push({
          type: 'error',
          message: 'Subject line is in ALL CAPS',
          suggestion: 'Use normal capitalization to avoid spam filters'
        });
        scoreDeductions += 25;
      }
    }

    // Content analysis
    if (content.length === 0) {
      issues.push({
        type: 'error',
        message: 'Email content is empty',
        suggestion: 'Add meaningful content to your email'
      });
      scoreDeductions += 40;
    } else {
      // Check for image-only emails
      const hasText = content.replace(/<[^>]*>/g, '').trim().length > 50;
      const imageCount = (content.match(/<img/gi) || []).length;
      
      if (imageCount > 0 && !hasText) {
        issues.push({
          type: 'error',
          message: 'Email appears to be image-only',
          suggestion: 'Add text content to improve deliverability and accessibility'
        });
        scoreDeductions += 30;
      }

      // Check text-to-image ratio
      const textLength = content.replace(/<[^>]*>/g, '').trim().length;
      if (imageCount > 0 && textLength / imageCount < 100) {
        issues.push({
          type: 'warning',
          message: 'Low text-to-image ratio',
          suggestion: 'Balance images with adequate text content'
        });
        scoreDeductions += 15;
      }

      // Check for excessive links
      const linkCount = (content.match(/<a\s+href/gi) || []).length;
      if (linkCount > 10) {
        issues.push({
          type: 'warning',
          message: 'Too many links detected',
          suggestion: 'Limit links to improve deliverability (recommended: under 10)'
        });
        scoreDeductions += 20;
      }
    }

    // Sender name analysis
    if (!senderName || senderName.trim().length === 0) {
      issues.push({
        type: 'warning',
        message: 'No sender name specified',
        suggestion: 'Add a recognizable sender name to improve trust'
      });
      scoreDeductions += 10;
    }

    // Preheader analysis
    if (!preheader || preheader.trim().length === 0) {
      recommendations.push('Add a preheader text to complement your subject line');
    }

    // Generate recommendations
    if (issues.length === 0) {
      recommendations.push('Great! Your email looks optimized for deliverability');
    } else {
      recommendations.push('Address the issues above to improve your email deliverability');
      recommendations.push('Test your email with different email clients before sending');
    }

    const finalScore = Math.max(0, 100 - scoreDeductions);
    
    return {
      score: finalScore,
      issues,
      recommendations
    };
  };

  useEffect(() => {
    const result = analyzeContent(subject, content, senderName, preheader);
    setScore(result);
  }, [subject, content, senderName, preheader]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Improvement';
    return 'Poor';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          Deliverability Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Deliverability Score</span>
            <span className={`text-lg font-bold ${getScoreColor(score.score)}`}>
              {score.score}/100 - {getScoreLabel(score.score)}
            </span>
          </div>
          <Progress value={score.score} className="h-2" />
        </div>

        {/* Issues */}
        {score.issues.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Issues Found</h4>
            {score.issues.map((issue, index) => (
              <Alert key={index} variant={issue.type === 'error' ? 'destructive' : 'default'}>
                <div className="flex items-start gap-2">
                  {issue.type === 'error' && <XCircle className="h-4 w-4 text-red-500 mt-0.5" />}
                  {issue.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />}
                  {issue.type === 'info' && <Info className="h-4 w-4 text-blue-500 mt-0.5" />}
                  <div className="flex-1">
                    <AlertDescription>
                      <div className="font-medium">{issue.message}</div>
                      {issue.suggestion && (
                        <div className="text-sm text-muted-foreground mt-1">{issue.suggestion}</div>
                      )}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {score.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Recommendations</h4>
            <ul className="space-y-1">
              {score.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
