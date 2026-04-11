import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormAnalyticsTab } from "@/components/forms/FormAnalyticsTab";
import { FormAnalyticsData } from "@/types/formBuilder";

const useFormAnalyticsMock = vi.fn();

vi.mock("@/hooks/useForms", () => ({
  useFormAnalytics: (...args: unknown[]) => useFormAnalyticsMock(...args),
}));

vi.mock("recharts", () => {
  const HtmlContainer = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const SvgContainer = ({ children }: { children?: React.ReactNode }) => (
    <svg>{children}</svg>
  );
  const GroupContainer = ({ children }: { children?: React.ReactNode }) => (
    <g>{children}</g>
  );

  return {
    ResponsiveContainer: HtmlContainer,
    AreaChart: SvgContainer,
    PieChart: SvgContainer,
    Pie: GroupContainer,
    Area: () => null,
    Cell: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const EMPTY_TREND = {
  hasTrend: false,
  direction: "none",
  sentiment: "neutral",
  changePercentage: null,
  deltaValue: null,
} as const;

function buildAnalyticsData(days: number = 30): FormAnalyticsData {
  return {
    range: {
      days,
      isAllTime: days === 0,
      comparisonLabel: days === 0 ? null : "vs previous equivalent period",
    },
    summary: {
      current: {
        totalSubmissions: 24,
        acceptedSubmissions: 18,
        rejectedSubmissions: 6,
        invalidSubmissions: 3,
        rateLimitedSubmissions: 2,
        spamSubmissions: 1,
        acceptanceRate: 75,
        rejectionRate: 25,
      },
      previous: {
        totalSubmissions: 16,
        acceptedSubmissions: 12,
        rejectedSubmissions: 4,
        invalidSubmissions: 2,
        rateLimitedSubmissions: 1,
        spamSubmissions: 1,
        acceptanceRate: 75,
        rejectionRate: 25,
      },
      metrics: {
        totalSubmissions: {
          value: 24,
          previousValue: 16,
          trend: {
            hasTrend: true,
            direction: "up",
            sentiment: "positive",
            changePercentage: 50,
            deltaValue: 8,
          },
        },
        acceptedSubmissions: {
          value: 18,
          previousValue: 12,
          trend: {
            hasTrend: true,
            direction: "up",
            sentiment: "positive",
            changePercentage: 50,
            deltaValue: 6,
          },
        },
        rejectedSubmissions: {
          value: 6,
          previousValue: 4,
          trend: {
            hasTrend: true,
            direction: "up",
            sentiment: "negative",
            changePercentage: 50,
            deltaValue: 2,
          },
        },
        conversionRate: {
          value: null,
          previousValue: null,
          trend: EMPTY_TREND,
        },
      },
    },
    daily: [
      { day: "2026-04-01", total: 8, accepted: 6, rejected: 2 },
      { day: "2026-04-02", total: 7, accepted: 5, rejected: 2 },
      { day: "2026-04-03", total: 9, accepted: 7, rejected: 2 },
    ],
    topReferrers: [
      {
        rank: 1,
        displayDomain: "google.com",
        sourceLabel: "https://google.com/search",
        count: 10,
        sharePercentage: 41.7,
        barPercentage: 100,
      },
    ],
    rejectionBreakdown: {
      totalRejections: 6,
      slices: [
        { key: "invalid", label: "Invalid", count: 3, percentage: 50 },
        {
          key: "rate_limited",
          label: "Rate Limited",
          count: 2,
          percentage: 33.3,
        },
        { key: "spam", label: "Spam", count: 1, percentage: 16.7 },
      ],
    },
    fieldFillRates: [
      {
        fieldId: "field-email",
        fieldKey: "email",
        label: "Email Address",
        fieldType: "email",
        fieldOrder: 1,
        required: true,
        filledCount: 24,
        totalSubmissions: 24,
        fillRate: 100,
      },
    ],
    conversion: {
      available: false,
      views: null,
      accepted: 18,
      rate: null,
      previousRate: null,
      note: "Enable form view tracking for conversion analytics.",
      trend: EMPTY_TREND,
    },
    totals: {
      totalSubmissions: 24,
      totalAccepted: 18,
      totalInvalid: 3,
      totalRateLimited: 2,
      totalSpam: 1,
    },
    total: 24,
    accepted: 18,
    rejected: 6,
    acceptanceRate: 75,
    lastSubmission: "2026-04-05T15:00:00.000Z",
  };
}

function buildEmptyAnalyticsData(): FormAnalyticsData {
  return {
    ...buildAnalyticsData(30),
    summary: {
      current: {
        totalSubmissions: 0,
        acceptedSubmissions: 0,
        rejectedSubmissions: 0,
        invalidSubmissions: 0,
        rateLimitedSubmissions: 0,
        spamSubmissions: 0,
        acceptanceRate: 0,
        rejectionRate: 0,
      },
      previous: {
        totalSubmissions: 0,
        acceptedSubmissions: 0,
        rejectedSubmissions: 0,
        invalidSubmissions: 0,
        rateLimitedSubmissions: 0,
        spamSubmissions: 0,
        acceptanceRate: 0,
        rejectionRate: 0,
      },
      metrics: {
        totalSubmissions: { value: 0, previousValue: 0, trend: EMPTY_TREND },
        acceptedSubmissions: { value: 0, previousValue: 0, trend: EMPTY_TREND },
        rejectedSubmissions: { value: 0, previousValue: 0, trend: EMPTY_TREND },
        conversionRate: {
          value: null,
          previousValue: null,
          trend: EMPTY_TREND,
        },
      },
    },
    daily: [],
    topReferrers: [],
    rejectionBreakdown: { totalRejections: 0, slices: [] },
    fieldFillRates: [],
    totals: {
      totalSubmissions: 0,
      totalAccepted: 0,
      totalInvalid: 0,
      totalRateLimited: 0,
      totalSpam: 0,
    },
    total: 0,
    accepted: 0,
    rejected: 0,
    acceptanceRate: 0,
    lastSubmission: null,
  };
}

describe("FormAnalyticsTab", () => {
  beforeEach(() => {
    useFormAnalyticsMock.mockReset();
  });

  it("refetches analytics using the selected preset day range", () => {
    useFormAnalyticsMock.mockImplementation(
      (_formId: string, _tenantId: string, days: number) => ({
        data: buildAnalyticsData(days),
        isLoading: false,
        error: null,
      }),
    );

    render(<FormAnalyticsTab formId="form-1" tenantId="tenant-1" />);

    expect(useFormAnalyticsMock).toHaveBeenLastCalledWith(
      "form-1",
      "tenant-1",
      30,
    );

    fireEvent.click(screen.getByRole("button", { name: "12M" }));

    expect(useFormAnalyticsMock).toHaveBeenLastCalledWith(
      "form-1",
      "tenant-1",
      365,
    );

    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(useFormAnalyticsMock).toHaveBeenLastCalledWith(
      "form-1",
      "tenant-1",
      0,
    );
  });

  it("shows the Share CTA in the zero-submission empty state for published forms", () => {
    const onOpenShare = vi.fn();

    useFormAnalyticsMock.mockReturnValue({
      data: buildEmptyAnalyticsData(),
      isLoading: false,
      error: null,
    });

    render(
      <FormAnalyticsTab
        formId="form-1"
        tenantId="tenant-1"
        isPublished
        onOpenShare={onOpenShare}
      />,
    );

    expect(
      screen.getByText("No submissions in this range yet"),
    ).toBeInTheDocument();

    const shareButton = screen.getByRole("button", { name: "Share" });
    expect(shareButton).toBeInTheDocument();

    fireEvent.click(shareButton);
    expect(onOpenShare).toHaveBeenCalledTimes(1);
  });

  it("hides the Share CTA in the zero-submission empty state for draft forms", () => {
    useFormAnalyticsMock.mockReturnValue({
      data: buildEmptyAnalyticsData(),
      isLoading: false,
      error: null,
    });

    render(<FormAnalyticsTab formId="form-1" tenantId="tenant-1" />);

    expect(
      screen.getByText("No submissions in this range yet"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Share" }),
    ).not.toBeInTheDocument();
  });
});
