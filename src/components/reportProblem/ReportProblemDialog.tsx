import { ReportProblemDialog as BloomReportProblemDialog } from "@/components/bloomSupport/ReportProblemDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Compatibility entry point: every dashboard report goes to the shared Bloom desk. */
export function ReportProblemDialog({ open, onOpenChange }: Props) {
  return <BloomReportProblemDialog open={open} onClose={() => onOpenChange(false)} />;
}
