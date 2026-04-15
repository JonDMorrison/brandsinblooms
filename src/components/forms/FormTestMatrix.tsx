import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { Badge } from "@/components/ui-legacy/badge";
import { Checkbox } from "@/components/ui-legacy/checkbox";
import {
  TestTube2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { Form } from "@/types/formBuilder";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from "@/integrations/supabase/config";
import { useToast } from "@/hooks/use-toast";

interface FormTestMatrixProps {
  form: Form;
}

type TestStatus = "pending" | "running" | "passed" | "failed" | "skipped";

interface TestCase {
  id: string;
  name: string;
  description: string;
  category: "consent" | "security" | "edge_case";
  run: (
    form: Form,
    supabaseUrl: string,
  ) => Promise<{ passed: boolean; message: string }>;
}

interface TestResult {
  testId: string;
  status: TestStatus;
  message?: string;
  timestamp?: string;
}

const TEST_CASES: TestCase[] = [
  {
    id: "email_consent_required",
    name: "Email Consent Required (CASL)",
    description:
      "Verifies that forms requiring email consent reject submissions without consent checkbox",
    category: "consent",
    run: async (form, supabaseUrl) => {
      if (!form.compliance_json.email_consent_required) {
        return {
          passed: true,
          message: "Skipped - email consent not required for this form",
        };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/submit-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embed_key: form.embed_key,
          data: {
            email: `test-${Date.now()}@example.com`,
            email_consent: false,
          },
          meta: {
            page_url: "https://test.local/matrix",
            is_test: true,
            source: "test_matrix",
          },
        }),
      });

      const result = await response.json();

      if (!response.ok && result.error?.includes("consent")) {
        return {
          passed: true,
          message: "Correctly rejected submission without email consent",
        };
      }

      return {
        passed: false,
        message: "Failed to reject submission without email consent",
      };
    },
  },
  {
    id: "sms_consent_required",
    name: "SMS Consent Required (TCPA)",
    description: "Verifies that forms with phone fields require SMS consent",
    category: "consent",
    run: async (form, supabaseUrl) => {
      const hasPhoneField = form.fields_json.some((f) => f.type === "phone");

      if (!hasPhoneField || !form.compliance_json.sms_consent_required) {
        return {
          passed: true,
          message: "Skipped - no phone field or SMS consent not required",
        };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/submit-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embed_key: form.embed_key,
          data: {
            email: `test-${Date.now()}@example.com`,
            phone: "+15551234567",
            email_consent: true,
            sms_consent: false,
          },
          meta: {
            page_url: "https://test.local/matrix",
            is_test: true,
            source: "test_matrix",
          },
        }),
      });

      const result = await response.json();

      if (!response.ok && result.error?.includes("SMS consent")) {
        return {
          passed: true,
          message: "Correctly rejected submission without SMS consent",
        };
      }

      return {
        passed: false,
        message: "Failed to reject submission without SMS consent",
      };
    },
  },
  {
    id: "honeypot_detection",
    name: "Honeypot Spam Detection",
    description: "Verifies that submissions with honeypot fields are rejected",
    category: "security",
    run: async (form, supabaseUrl) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embed_key: form.embed_key,
          data: {
            email: `test-${Date.now()}@example.com`,
            email_consent: true,
            _honeypot: "I am a bot!",
          },
          meta: {
            page_url: "https://test.local/matrix",
            is_test: true,
            source: "test_matrix",
          },
        }),
      });

      const result = await response.json();

      if (!response.ok && result.error?.toLowerCase().includes("spam")) {
        return { passed: true, message: "Correctly detected honeypot spam" };
      }

      if (response.ok) {
        return {
          passed: false,
          message: "Honeypot submission was incorrectly accepted",
        };
      }

      return { passed: false, message: `Unexpected response: ${result.error}` };
    },
  },
  {
    id: "rate_limiting",
    name: "Rate Limiting Protection",
    description: "Verifies that rapid submissions trigger rate limiting",
    category: "security",
    run: async (form, supabaseUrl) => {
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(
          fetch(`${supabaseUrl}/functions/v1/submit-form`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              embed_key: form.embed_key,
              data: {
                email: `ratelimit-test-${Date.now()}-${i}@example.com`,
                email_consent: true,
              },
              meta: {
                page_url: "https://test.local/matrix/ratelimit",
                is_test: true,
                source: "test_matrix",
              },
            }),
          }),
        );
      }

      const responses = await Promise.all(promises);
      const results = await Promise.all(responses.map((r) => r.json()));

      const rateLimited = results.some((r) =>
        r.error?.toLowerCase().includes("rate limit"),
      );

      if (rateLimited) {
        return {
          passed: true,
          message: "Rate limiting correctly triggered after rapid submissions",
        };
      }

      return {
        passed: false,
        message: "Rate limiting did not trigger after 6 rapid submissions",
      };
    },
  },
  {
    id: "valid_submission",
    name: "Valid Submission Acceptance",
    description: "Verifies that a properly filled form is accepted",
    category: "edge_case",
    run: async (form, supabaseUrl) => {
      const testData: Record<string, any> = {
        email: `valid-test-${Date.now()}@example.com`,
      };

      if (form.compliance_json.email_consent_required) {
        testData.email_consent = true;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/submit-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embed_key: form.embed_key,
          data: testData,
          meta: {
            page_url: "https://test.local/matrix",
            utm_source: "test_matrix",
            is_test: true,
            source: "test_matrix",
          },
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          passed: true,
          message: `Submission accepted. Customer ID: ${result.customer_id?.slice(0, 8)}...`,
        };
      }

      return { passed: false, message: `Submission failed: ${result.error}` };
    },
  },
  {
    id: "missing_required_field",
    name: "Missing Required Field Rejection",
    description:
      "Verifies that submissions missing required fields are rejected",
    category: "edge_case",
    run: async (form, supabaseUrl) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embed_key: form.embed_key,
          data: {
            first_name: "Test",
            email_consent: true,
          },
          meta: {
            page_url: "https://test.local/matrix",
            is_test: true,
            source: "test_matrix",
          },
        }),
      });

      const result = await response.json();

      if (!response.ok && result.error?.includes("required")) {
        return {
          passed: true,
          message: "Correctly rejected submission with missing required fields",
        };
      }

      if (response.ok) {
        return {
          passed: false,
          message: "Submission without email was incorrectly accepted",
        };
      }

      return { passed: false, message: `Unexpected response: ${result.error}` };
    },
  },
];

export function FormTestMatrix({ form }: FormTestMatrixProps) {
  const { toast } = useToast();
  const [results, setResults] = useState<Map<string, TestResult>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(
    new Set(TEST_CASES.map((t) => t.id)),
  );

  const supabaseUrl = SUPABASE_URL;

  const runTest = async (testCase: TestCase) => {
    setResults((prev) =>
      new Map(prev).set(testCase.id, {
        testId: testCase.id,
        status: "running",
      }),
    );

    try {
      const result = await testCase.run(form, supabaseUrl);
      setResults((prev) =>
        new Map(prev).set(testCase.id, {
          testId: testCase.id,
          status: result.passed ? "passed" : "failed",
          message: result.message,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error: any) {
      setResults((prev) =>
        new Map(prev).set(testCase.id, {
          testId: testCase.id,
          status: "failed",
          message: `Error: ${error.message}`,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  };

  const runAllTests = async () => {
    if (form.status !== "published") {
      toast({
        title: "Form not published",
        description: "Please publish the form before running tests.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);

    for (const testCase of TEST_CASES) {
      if (selectedTests.has(testCase.id)) {
        await runTest(testCase);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setIsRunning(false);

    const passedCount = Array.from(results.values()).filter(
      (r) => r.status === "passed",
    ).length;
    toast({
      title: "Test run complete",
      description: `${passedCount}/${selectedTests.size} tests passed`,
    });
  };

  const resetTests = () => {
    setResults(new Map());
  };

  const toggleTest = (testId: string) => {
    setSelectedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const groupedTests = {
    consent: TEST_CASES.filter((t) => t.category === "consent"),
    security: TEST_CASES.filter((t) => t.category === "security"),
    edge_case: TEST_CASES.filter((t) => t.category === "edge_case"),
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TestTube2 className="h-5 w-5" />
              Test Matrix
            </CardTitle>
            <CardDescription>
              Automated tests for form submission flows
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetTests}
              disabled={isRunning || results.size === 0}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={runAllTests}
              disabled={isRunning || form.status !== "published"}
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Tests
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {form.status !== "published" && (
          <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
            Publish your form to run the test matrix
          </div>
        )}

        {/* Consent Tests */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">
            Consent Compliance
          </h4>
          <div className="space-y-2">
            {groupedTests.consent.map((test) => (
              <TestRow
                key={test.id}
                test={test}
                result={results.get(test.id)}
                selected={selectedTests.has(test.id)}
                onToggle={() => toggleTest(test.id)}
                disabled={isRunning}
              />
            ))}
          </div>
        </div>

        {/* Security Tests */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">
            Security & Abuse Prevention
          </h4>
          <div className="space-y-2">
            {groupedTests.security.map((test) => (
              <TestRow
                key={test.id}
                test={test}
                result={results.get(test.id)}
                selected={selectedTests.has(test.id)}
                onToggle={() => toggleTest(test.id)}
                disabled={isRunning}
              />
            ))}
          </div>
        </div>

        {/* Edge Case Tests */}
        <div>
          <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">
            Edge Cases
          </h4>
          <div className="space-y-2">
            {groupedTests.edge_case.map((test) => (
              <TestRow
                key={test.id}
                test={test}
                result={results.get(test.id)}
                selected={selectedTests.has(test.id)}
                onToggle={() => toggleTest(test.id)}
                disabled={isRunning}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TestRow({
  test,
  result,
  selected,
  onToggle,
  disabled,
}: {
  test: TestCase;
  result?: TestResult;
  selected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const getStatusIcon = () => {
    if (!result) return null;

    switch (result.status) {
      case "running":
        return (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        );
      case "passed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "skipped":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{test.name}</span>
          {getStatusIcon()}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {test.description}
        </p>
        {result?.message && (
          <p
            className={`text-xs mt-1 ${
              result.status === "passed"
                ? "text-green-600"
                : result.status === "failed"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {result.message}
          </p>
        )}
      </div>
    </div>
  );
}
