import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ReceiptText } from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";
import { ResultCardShell } from "@/components/bloom/content/cards/ResultCardShell";
import {
  formatCurrency,
  formatDate,
  formatLabel,
  formatNumber,
  getValue,
  readString,
  statusTone,
  type NormalizedToolResult,
  visibleRows,
} from "@/components/bloom/content/cards/cardUtils";

export function OrderResultCard({ result }: { result: NormalizedToolResult }) {
  const { overflow, rows, total } = visibleRows(result);

  return (
    <ResultCardShell
      icon={<ReceiptText size={15} strokeWidth={1.9} />}
      title="Orders"
      meta={`${total.toLocaleString()} recent`}
    >
      <Stack
        divider={
          <Divider
            sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
          />
        }
      >
        {rows.length > 0 ? (
          rows.map((order, index) => {
            const orderNumber =
              readString(
                getValue(order, ["order_number", "external_id", "id"]),
              ) ?? `Order ${index + 1}`;
            const customer = readString(
              getValue(order, [
                "customer_name",
                "customer",
                "email",
                "customer_email",
              ]),
            );
            const amount = formatCurrency(
              getValue(order, ["total_amount", "total_price", "total"]),
              order.currency,
            );
            const status =
              readString(
                getValue(order, [
                  "status",
                  "financial_status",
                  "fulfillment_status",
                ]),
              ) ?? "completed";
            const orderDate = formatDate(
              getValue(order, ["order_date", "created_at", "date"]),
            );
            const itemCount = formatNumber(
              getValue(order, ["items_count", "item_count", "line_item_count"]),
            );

            return (
              <Box key={`${orderNumber}-${index}`} sx={{ py: 1.25 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={0.75}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                >
                  <Typography
                    level="body-sm"
                    sx={{
                      color: "neutral.800",
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {orderNumber}
                  </Typography>
                  {customer ? (
                    <Typography
                      level="body-sm"
                      noWrap
                      sx={{ color: "neutral.600", minWidth: 0, flex: 1 }}
                    >
                      {customer}
                    </Typography>
                  ) : null}
                  {amount ? (
                    <Typography
                      level="body-sm"
                      sx={{
                        color: "neutral.800",
                        fontWeight: 500,
                        fontVariantNumeric: "tabular-nums",
                        flexShrink: 0,
                      }}
                    >
                      {amount}
                    </Typography>
                  ) : null}
                  <JoyChip
                    color={statusTone(status)}
                    size="sm"
                    variant="soft"
                    sx={{ height: 20, fontSize: "11px" }}
                  >
                    {formatLabel(status)}
                  </JoyChip>
                </Stack>
                <Typography
                  level="body-xs"
                  sx={{ color: "neutral.500", mt: 0.35 }}
                >
                  {[orderDate, itemCount ? `${itemCount} items` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Typography>
              </Box>
            );
          })
        ) : (
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            No order rows were returned.
          </Typography>
        )}
      </Stack>
      {overflow > 0 ? (
        <Typography level="body-xs" sx={{ color: "neutral.500", mt: 1.25 }}>
          and {overflow.toLocaleString()} more
        </Typography>
      ) : null}
    </ResultCardShell>
  );
}
