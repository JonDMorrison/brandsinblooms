import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it } from "vitest";

import {
  SegmentsAudienceSelect,
  type SegmentsAudienceChange,
} from "@/components/crm/campaign-editor/SegmentsAudienceSelect";
import { ALL_CONTACTS_SEGMENT_ID } from "@/components/crm/campaign-editor/segmentsAudienceConstants";
import type { CampaignSegmentSummary } from "@/lib/crm/campaignEditor";

const SEGMENT_SUMMER: CampaignSegmentSummary = {
  id: "segment-summer",
  name: "Summer Bloomers",
  description: null,
  customer_count: 42,
};

const SEGMENT_FALL: CampaignSegmentSummary = {
  id: "segment-fall",
  name: "Fall Planters",
  description: null,
  customer_count: 30,
};

interface HarnessProps {
  initialSelectedSegments?: CampaignSegmentSummary[];
  initialIncludeAllCustomers?: boolean;
  onAudienceStateChange?: (state: {
    selectedSegments: CampaignSegmentSummary[];
    includeAllCustomers: boolean;
  }) => void;
}

function Harness({
  initialSelectedSegments = [SEGMENT_SUMMER],
  initialIncludeAllCustomers = false,
  onAudienceStateChange,
}: HarnessProps) {
  const [selectedSegments, setSelectedSegments] = React.useState(
    initialSelectedSegments,
  );
  const [includeAllCustomers, setIncludeAllCustomers] = React.useState(
    initialIncludeAllCustomers,
  );

  const handleChange = React.useCallback(
    (next: SegmentsAudienceChange) => {
      const nextSegments = next.selectedSegments ?? selectedSegments;
      const nextInclude = next.includeAllCustomers ?? includeAllCustomers;
      setSelectedSegments(nextSegments);
      setIncludeAllCustomers(nextInclude);
      onAudienceStateChange?.({
        selectedSegments: nextSegments,
        includeAllCustomers: nextInclude,
      });
    },
    [includeAllCustomers, onAudienceStateChange, selectedSegments],
  );

  return (
    <SegmentsAudienceSelect
      segments={[SEGMENT_SUMMER, SEGMENT_FALL]}
      selectedSegments={selectedSegments}
      includeAllCustomers={includeAllCustomers}
      onChange={handleChange}
    />
  );
}

describe("SegmentsAudienceSelect", () => {
  it("shows the selected real segment pill on initial render", () => {
    render(<Harness />);
    expect(
      screen.getByTestId("segment-pill-segment-summer"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("segment-pill-all-contacts"),
    ).not.toBeInTheDocument();
  });

  it("selecting All Contacts clears real segments and sets includeAllCustomers=true", async () => {
    const user = userEvent.setup();
    let latestState: {
      selectedSegments: CampaignSegmentSummary[];
      includeAllCustomers: boolean;
    } | null = null;

    render(
      <Harness
        onAudienceStateChange={(state) => {
          latestState = state;
        }}
      />,
    );

    // Open the dropdown.
    await user.click(screen.getByRole("combobox"));

    // Pick the All Contacts option.
    const allContactsOption = await screen.findByTestId(
      "segment-option-all-contacts",
    );
    await user.click(allContactsOption);

    await waitFor(() => {
      expect(latestState).toEqual({
        selectedSegments: [],
        includeAllCustomers: true,
      });
    });

    expect(
      screen.getByTestId("segment-pill-all-contacts"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("segment-pill-segment-summer"),
    ).not.toBeInTheDocument();
  });

  it("removing the All Contacts pill via its X clears includeAllCustomers", async () => {
    const user = userEvent.setup();
    let latestState: {
      selectedSegments: CampaignSegmentSummary[];
      includeAllCustomers: boolean;
    } | null = null;

    render(
      <Harness
        initialSelectedSegments={[]}
        initialIncludeAllCustomers={true}
        onAudienceStateChange={(state) => {
          latestState = state;
        }}
      />,
    );

    const pill = screen.getByTestId("segment-pill-all-contacts");
    const deleteButton = within(pill).getByRole("button", {
      name: /remove all contacts/i,
    });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(latestState).toEqual({
        selectedSegments: [],
        includeAllCustomers: false,
      });
    });

    expect(
      screen.queryByTestId("segment-pill-all-contacts"),
    ).not.toBeInTheDocument();
  });

  it("real segment options are disabled while All Contacts is selected", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initialSelectedSegments={[]}
        initialIncludeAllCustomers={true}
      />,
    );

    await user.click(screen.getByRole("combobox"));

    const summerOption = await screen.findByText("Summer Bloomers");
    const optionEl = summerOption.closest("[role='option']");
    expect(optionEl).toHaveAttribute("aria-disabled", "true");
  });

  it("exports a stable sentinel id", () => {
    expect(ALL_CONTACTS_SEGMENT_ID).toBe("__ALL_CONTACTS__");
  });
});
