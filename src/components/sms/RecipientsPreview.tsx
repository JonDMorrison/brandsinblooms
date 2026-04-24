import * as React from "react";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Mail, Phone, User } from "lucide-react";
import { useAllPersonas } from "@/hooks/useAllPersonas";

interface CRMCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  persona?: string;
  persona_id?: string;
}

interface RecipientsPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CRMCustomer[];
}

export const RecipientsPreview: React.FC<RecipientsPreviewProps> = ({
  isOpen,
  onClose,
  customers,
}) => {
  const { personas } = useAllPersonas();

  const getCustomerName = React.useCallback((customer: CRMCustomer) => {
    if (customer.first_name || customer.last_name) {
      return `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
    }
    return customer.email.split("@")[0];
  }, []);

  const getCustomerPersonaName = React.useCallback(
    (customer: CRMCustomer) => {
      if (customer.persona_id) {
        return personas.find((persona) => persona.id === customer.persona_id)
          ?.persona_name;
      }
      return customer.persona;
    },
    [personas],
  );

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalDialog layout="fullscreen" sx={{ p: 0 }}>
        <Sheet
          variant="plain"
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            backgroundColor: "background.body",
          }}
        >
          <Stack spacing={2} sx={{ px: { xs: 2.5, md: 3 }, pt: 3, pb: 2 }}>
            <ModalClose />
            <Stack spacing={0.75}>
              <Typography level="h2">Campaign Recipients</Typography>
              <Typography level="body-sm" color="neutral">
                Preview the current audience match before launching an SMS
                campaign.
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip size="sm" variant="soft" color="primary">
                {`${customers.length.toLocaleString()} recipients`}
              </Chip>
            </Stack>
          </Stack>

          <Divider />

          <Sheet
            sx={{ flex: 1, overflow: "auto", px: { xs: 2.5, md: 3 }, py: 2.5 }}
          >
            {customers.length === 0 ? (
              <Card
                variant="soft"
                color="neutral"
                sx={{
                  borderRadius: "24px",
                  p: 3,
                  maxWidth: 520,
                  mx: "auto",
                  textAlign: "center",
                }}
              >
                <Stack spacing={1.25} alignItems="center">
                  <Sheet
                    variant="outlined"
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: "20px",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <User size={22} />
                  </Sheet>
                  <Typography level="title-lg">No recipients found</Typography>
                  <Typography level="body-sm" color="neutral">
                    Try adjusting your targeting or confirm that matching
                    customers are opted in to SMS.
                  </Typography>
                </Stack>
              </Card>
            ) : (
              <Stack spacing={1.25}>
                {customers.map((customer) => {
                  const personaName = getCustomerPersonaName(customer);
                  return (
                    <Card
                      key={customer.id}
                      variant="outlined"
                      sx={{
                        borderRadius: "22px",
                        borderColor: "neutral.200",
                        p: 2,
                      }}
                    >
                      <Stack spacing={1.25}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ sm: "center" }}
                        >
                          <Stack spacing={0.35}>
                            <Typography level="title-sm">
                              {getCustomerName(customer)}
                            </Typography>
                            <Typography level="body-xs" color="neutral">
                              {customer.email}
                            </Typography>
                          </Stack>
                          {personaName ? (
                            <Chip size="sm" variant="soft" color="primary">
                              {personaName}
                            </Chip>
                          ) : null}
                        </Stack>

                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={2}
                          useFlexGap
                          flexWrap="wrap"
                        >
                          <Stack
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                          >
                            <Mail size={14} />
                            <Typography level="body-sm">
                              {customer.email}
                            </Typography>
                          </Stack>
                          {customer.phone ? (
                            <Stack
                              direction="row"
                              spacing={0.75}
                              alignItems="center"
                            >
                              <Phone size={14} />
                              <Typography level="body-sm">
                                {customer.phone}
                              </Typography>
                            </Stack>
                          ) : null}
                        </Stack>
                      </Stack>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Sheet>
        </Sheet>
      </ModalDialog>
    </Modal>
  );
};
