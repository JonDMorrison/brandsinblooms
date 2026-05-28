import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Users } from "lucide-react";
import { ResultCardShell } from "@/components/bloom/content/cards/ResultCardShell";
import {
  customerDisplayName,
  formatCurrency,
  formatDate,
  getValue,
  initialsFor,
  mutationStateForResult,
  readString,
  type NormalizedToolResult,
  visibleRows,
} from "@/components/bloom/content/cards/cardUtils";
import { ResultOutcomeBanner } from "@/components/bloom/content/cards/ResultOutcomeBanner";

export function CustomerResultCard({
  result,
}: {
  result: NormalizedToolResult;
}) {
  const { overflow, rows, total } = visibleRows(result);
  const mutationState = mutationStateForResult(result);

  return (
    <ResultCardShell
      icon={<Users size={15} strokeWidth={1.9} />}
      title={total === 1 ? "Customer" : "Customers"}
      meta={mutationState ? undefined : `${total.toLocaleString()} found`}
    >
      <Stack spacing={1.25}>
        {mutationState ? (
          <ResultOutcomeBanner
            entityLabel="customer"
            message={result.message}
            state={mutationState}
          />
        ) : null}
        <Stack
          divider={
            <Divider
              sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
            />
          }
        >
          {rows.length > 0 ? (
            rows.map((customer, index) => {
              const name = customerDisplayName(customer);
              const email = readString(
                getValue(customer, ["email", "customer_email"]),
              );
              const phone = readString(
                getValue(customer, ["phone", "customer_phone"]),
              );
              const lastOrder = formatDate(
                getValue(customer, [
                  "last_order_date",
                  "last_purchase_date",
                  "purchase_metrics.last_purchase_date",
                ]),
              );
              const totalSpent = formatCurrency(
                getValue(customer, [
                  "total_spent",
                  "lifetime_value",
                  "purchase_metrics.total_spent",
                ]),
              );
              const detailLine = [email, phone].filter(Boolean).join(" · ");
              const activityLine = [
                lastOrder ? `Last order: ${lastOrder}` : null,
                totalSpent ? `Total spent: ${totalSpent}` : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <Box
                  key={`${name}-${index}`}
                  sx={{ display: "flex", gap: 1.5, py: 1.5 }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      backgroundColor: "neutral.100",
                      color: "neutral.700",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {initialsFor(name)}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      level="body-sm"
                      noWrap
                      sx={{ color: "neutral.800", fontWeight: 500 }}
                    >
                      {name}
                    </Typography>
                    {detailLine ? (
                      <Typography
                        level="body-xs"
                        sx={{ color: "neutral.500", overflowWrap: "anywhere" }}
                      >
                        {detailLine}
                      </Typography>
                    ) : null}
                    {activityLine ? (
                      <Typography
                        level="body-xs"
                        sx={{ color: "neutral.400", mt: 0.25 }}
                      >
                        {activityLine}
                      </Typography>
                    ) : null}
                  </Box>
                </Box>
              );
            })
          ) : (
            <Typography level="body-sm" sx={{ color: "neutral.500" }}>
              No customer rows were returned.
            </Typography>
          )}
        </Stack>
        {overflow > 0 ? (
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            and {overflow.toLocaleString()} more
          </Typography>
        ) : null}
      </Stack>
    </ResultCardShell>
  );
}
