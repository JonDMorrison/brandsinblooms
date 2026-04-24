import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import { AddOnSection } from "./AddOnSection";
import { BillingHistory } from "./BillingHistory";
import { PaymentMethods } from "./PaymentMethods";
import { SubscriptionCard } from "./SubscriptionCard";

export const BillingDashboard = () => {
  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <Box>
          <SubscriptionCard />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <Box>
          <PaymentMethods />
        </Box>
        <Box>
          <BillingHistory />
        </Box>
      </Box>

      <Box>
      <AddOnSection />
      </Box>
    </Stack>
  );
};