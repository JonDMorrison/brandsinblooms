import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Package } from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";
import { ResultCardShell } from "@/components/bloom/content/cards/ResultCardShell";
import {
  formatCurrency,
  formatLabel,
  formatNumber,
  getValue,
  mutationStateForResult,
  readNumber,
  readString,
  statusTone,
  type NormalizedToolResult,
  visibleRows,
} from "@/components/bloom/content/cards/cardUtils";
import { ResultOutcomeBanner } from "@/components/bloom/content/cards/ResultOutcomeBanner";
import {
  readProductStockLevel,
  stockPercentOfThreshold,
} from "@/components/bloom/utils/productStock";

export function InventoryResultCard({
  result,
}: {
  result: NormalizedToolResult;
}) {
  const { overflow, rows, total } = visibleRows(result);
  const mutationState = mutationStateForResult(result);

  return (
    <ResultCardShell
      icon={<Package size={15} strokeWidth={1.9} />}
      title={total === 1 ? "Product" : "Inventory"}
      meta={mutationState ? undefined : `${total.toLocaleString()} items`}
    >
      <Stack spacing={1.25}>
        {mutationState ? (
          <ResultOutcomeBanner
            entityLabel="product"
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
            rows.map((product, index) => {
              const name =
                readString(getValue(product, ["name", "title"])) ??
                "Unnamed product";
              const sku = readString(
                getValue(product, ["sku", "barcode", "external_id"]),
              );
              const price = formatCurrency(
                getValue(product, ["price", "amount"]),
                product.currency,
              );
              const stock =
                readNumber(
                  getValue(product, [
                    "inventory_count",
                    "stock",
                    "quantity",
                    "in_stock",
                  ]),
                ) ?? 0;
              const { isLow: lowStock, threshold, tracked } =
                readProductStockLevel(product);
              // The bar measures stock against the product's own low-stock
              // threshold; without a tracked threshold there is nothing to
              // measure against, so no bar is drawn.
              const showStockBar = tracked && threshold !== null;
              const stockPercent =
                threshold !== null
                  ? stockPercentOfThreshold(stock, threshold)
                  : 0;

              return (
                <Box key={`${name}-${index}`} sx={{ py: 1.5 }}>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        level="body-sm"
                        sx={{
                          color: "neutral.800",
                          fontWeight: 500,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {name}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        {[
                          sku ? `SKU: ${sku}` : null,
                          `In stock: ${formatNumber(stock) ?? "0"}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Typography>
                    </Box>
                    <Stack
                      spacing={0.5}
                      alignItems="flex-end"
                      sx={{ flexShrink: 0 }}
                    >
                      {price ? (
                        <Typography
                          level="body-sm"
                          sx={{
                            color: "neutral.800",
                            fontWeight: 500,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {price}
                        </Typography>
                      ) : null}
                      {lowStock ? (
                        <JoyChip color="warning" size="sm" variant="soft">
                          Low
                        </JoyChip>
                      ) : product.status ? (
                        <JoyChip
                          color={statusTone(product.status)}
                          size="sm"
                          variant="soft"
                        >
                          {formatLabel(product.status)}
                        </JoyChip>
                      ) : null}
                    </Stack>
                  </Stack>
                  {showStockBar ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mt: 1,
                      }}
                    >
                      <Box
                        role="meter"
                        aria-label={`${formatNumber(stock) ?? "0"} in stock, low-stock threshold ${formatNumber(threshold) ?? "0"}`}
                        aria-valuemin={0}
                        aria-valuemax={threshold}
                        aria-valuenow={Math.min(stock, threshold)}
                        sx={{
                          flex: 1,
                          height: 4,
                          borderRadius: 999,
                          backgroundColor: "neutral.100",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            width: `${stockPercent}%`,
                            height: "100%",
                            borderRadius: 999,
                            backgroundColor: lowStock
                              ? "warning.500"
                              : "primary.500",
                            transition: "width 500ms ease",
                          }}
                        />
                      </Box>
                      <Typography
                        level="body-xs"
                        sx={{
                          color: lowStock ? "warning.600" : "neutral.500",
                          fontVariantNumeric: "tabular-nums",
                          fontSize: "11px",
                          flexShrink: 0,
                        }}
                      >
                        {formatNumber(stock) ?? "0"} /{" "}
                        {formatNumber(threshold) ?? "0"} threshold
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
              );
            })
          ) : (
            <Typography level="body-sm" sx={{ color: "neutral.500" }}>
              No inventory rows were returned.
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
