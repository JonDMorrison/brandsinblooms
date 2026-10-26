import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import type { StudioBlock } from "@/types/studioBlocks";

export default function CouponRenderer({ block }: { block: StudioBlock }) {
  const offer = block.couponOffer === "bogo" ? "BUY ONE GET ONE" : block.couponOffer === "50" ? "50% OFF" : "25% OFF";
  const image = block.imageUrl ? <Box component="img" src={block.imageUrl} alt={block.imageAlt || "Coupon offer"} sx={{ width: { xs: "100%", sm: "38%" }, objectFit: "cover", maxHeight: 220 }} /> : null;
  return <Box sx={{ bgcolor: "#fff", color: "#172d2c", border: block.couponBorder === false ? "none" : "2px dashed #71817d" }}>
    {block.couponScissors !== false && <Box sx={{ px: 2, py: 0.75, borderBottom: "1px dashed #a0aaa5", fontSize: 12 }}>✂ &nbsp; Cut or save this coupon</Box>}
    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: "center" }}>
      {block.couponImageSide !== "right" && image}
      <Box sx={{ p: 3, flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 25, color: "#172d2c" }}>{offer}</Typography>
        {block.headline && <Typography sx={{ fontWeight: 700, fontSize: 18, mt: 1, color: "#172d2c" }}>{block.headline}</Typography>}
        {block.body && <Typography sx={{ mt: 1, color: "#172d2c", whiteSpace: "pre-line" }}>{block.body}</Typography>}
        {block.couponPrice && <Typography sx={{ mt: 1, fontWeight: 700, color: "#172d2c" }}>{block.couponPrice}</Typography>}
        {block.couponConditions && <Typography sx={{ mt: 1.5, fontSize: 12, color: "#46595a", whiteSpace: "pre-line" }}>{block.couponConditions}</Typography>}
        {block.buttonUrl && <Box component="a" href={block.buttonUrl} target="_blank" rel="noopener noreferrer" sx={{ mt: 2, px: 2, py: 1.25, display: "inline-block", bgcolor: "#1f4341", color: "#fff", borderRadius: "5px", textDecoration: "none" }}>{block.buttonText || "Shop this offer"}</Box>}
      </Box>
      {block.couponImageSide === "right" && image}
    </Box>
  </Box>;
}
