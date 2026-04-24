import * as React from "react";
import { SenderVerificationModal } from "@/components/crm/campaigns/SenderVerificationModal";
import { useSenderConfiguration } from "@/hooks/useSenderConfiguration";

export function SenderVerificationDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { senderConfig } = useSenderConfiguration();

  return (
    <SenderVerificationModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      senderConfig={senderConfig}
    />
  );
}
