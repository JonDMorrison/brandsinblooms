import * as React from "react";
import { SenderVerificationModal } from "@/components/crm/campaigns/SenderVerificationModal";
import { useSenderConfiguration } from "@/hooks/useSenderConfiguration";

export function SenderVerificationDialog({
  open,
  onClose,
  campaignSenderEmail,
  onChooseVerifiedSender,
}: {
  open: boolean;
  onClose: () => void;
  campaignSenderEmail?: string;
  onChooseVerifiedSender?: (email: string) => void;
}) {
  const { senderConfig } = useSenderConfiguration();

  if (!open) {
    return null;
  }

  return (
    <SenderVerificationModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      senderConfig={senderConfig}
      campaignSenderEmail={campaignSenderEmail}
      onChooseVerifiedSender={onChooseVerifiedSender}
    />
  );
}
