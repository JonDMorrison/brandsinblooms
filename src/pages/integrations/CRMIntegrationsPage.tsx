import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import mailchimpLogo from "@/assets/logos/mailchimp-new.png";
import klaviyoLogo from "@/assets/logos/klaviyo.jpeg";
import constantContactLogo from "@/assets/logos/constant-contact.svg";
import { MailchimpStatusBadge } from "@/components/integrations/MailchimpStatusBadge";

export default function CRMIntegrationsPage() {
  const navigate = useNavigate();

  const providers = [
    {
      id: "mailchimp",
      name: "Mailchimp",
      description: "Import contacts, segments, and tags from Mailchimp",
      logo: mailchimpLogo,
      hasStatusBadge: true,
    },
    {
      id: "klaviyo",
      name: "Klaviyo",
      description: "Import contacts, segments, and lists from Klaviyo",
      logo: klaviyoLogo,
      hasStatusBadge: false,
    },
    {
      id: "constant_contact",
      name: "Constant Contact",
      description: "Import contacts and lists from Constant Contact",
      logo: constantContactLogo,
      hasStatusBadge: false,
    },
  ];

  const handleStartMigration = (provider: string) => {
    if (provider === "mailchimp") {
      navigate("/integrations/mailchimp");
      return;
    }

    navigate(`/integrations/migrations?provider=${provider}`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link
        to="/integrations"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Integrations
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Import Contacts</h1>
        <p className="text-muted-foreground">
          One-time import from your email marketing platform
        </p>
      </div>

      <div className="grid gap-4">
        {providers.map((provider) => (
          <Card
            key={provider.id}
            className="bg-card border border-border rounded-xl"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img
                    src={provider.logo}
                    alt={`${provider.name} logo`}
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{provider.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {provider.description}
                  </p>

                  {provider.hasStatusBadge && provider.id === "mailchimp" && (
                    <div className="mt-2">
                      <MailchimpStatusBadge
                        onRetry={() => handleStartMigration(provider.id)}
                      />
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => handleStartMigration(provider.id)}
                  className="flex-shrink-0"
                >
                  Import
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Includes contacts, consent status, tags, and segments with AI-powered
        field mapping
      </p>
    </div>
  );
}
