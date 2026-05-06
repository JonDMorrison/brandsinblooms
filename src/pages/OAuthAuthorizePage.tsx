import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";

import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface CompleteResponse {
  redirectUrl?: string;
}

interface RequestPreview {
  clientName: string | null;
  isFirstParty: boolean;
}

function base64UrlDecode(value: string): string {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return window.atob(padded);
}

function decodeRequestPreview(
  requestJwt: string | null,
): RequestPreview | null {
  if (!requestJwt) return null;

  try {
    const [, payload] = requestJwt.split(".");
    if (!payload) return null;

    const parsed = JSON.parse(base64UrlDecode(payload)) as Record<
      string,
      unknown
    >;
    return {
      clientName:
        typeof parsed.client_name === "string" ? parsed.client_name : null,
      isFirstParty: parsed.is_first_party !== false,
    };
  } catch {
    return null;
  }
}

export default function OAuthAuthorizePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, session, loading } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStartedCompletion = useRef(false);

  const requestJwt = useMemo(() => {
    return new URLSearchParams(location.search).get("request_jwt");
  }, [location.search]);

  const requestPreview = useMemo(
    () => decodeRequestPreview(requestJwt),
    [requestJwt],
  );
  const title = requestPreview?.clientName
    ? `Authorizing ${requestPreview.clientName}`
    : "Authorizing connection";

  useEffect(() => {
    if (loading) return;

    if (!requestJwt) {
      setErrorMessage("The authorization request is missing or invalid.");
      return;
    }

    if (requestPreview?.isFirstParty === false) {
      setErrorMessage("Consent for this application is not available yet.");
      return;
    }

    if (!user || !session?.access_token) {
      const returnTo = `${location.pathname}${location.search}`;
      navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`, {
        replace: true,
      });
      return;
    }

    if (hasStartedCompletion.current) return;
    hasStartedCompletion.current = true;

    let cancelled = false;

    async function completeAuthorization() {
      const { data, error } = await supabase.functions.invoke(
        "oauth-authorize-complete",
        {
          body: {
            request_jwt: requestJwt,
            access_token: session.access_token,
          },
        },
      );

      if (cancelled) return;

      if (error) {
        throw error;
      }

      const redirectUrl = (data as CompleteResponse | null)?.redirectUrl;
      if (!redirectUrl) {
        throw new Error(
          "Authorization response did not include a redirect URL.",
        );
      }

      window.location.assign(redirectUrl);
    }

    completeAuthorization().catch(() => {
      if (!cancelled) {
        setErrorMessage("The authorization request could not be completed.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    location.pathname,
    location.search,
    navigate,
    requestJwt,
    requestPreview,
    session,
    user,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <LandingPageHeader onLogin={() => {}} showUserMenu={false} />
      <div className="flex items-center justify-center px-4 py-20">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              {errorMessage ? "Authorization failed" : title}
            </CardTitle>
            <CardDescription>
              {errorMessage || "Preparing your secure redirect."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              {errorMessage ? (
                <AlertCircle
                  className="h-8 w-8 text-red-500"
                  aria-hidden="true"
                />
              ) : (
                <Loader2
                  className="h-8 w-8 animate-spin text-primary"
                  aria-hidden="true"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
