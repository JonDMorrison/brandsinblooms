import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOAuthRedirectUri } from "@/utils/environmentUtils";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { toast } from "sonner";

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getOAuthRedirectUri("/reset-password"),
      });

      if (error) {
        const rawMessage = (error.message || "").toLowerCase();

        console.error("Password reset error:", error);

        if (error.status === 429 || rawMessage.includes("rate")) {
          toast.error("Too many requests. Please try again in a few minutes.");
          return;
        }

        if (
          rawMessage.includes("redirect") ||
          rawMessage.includes("not allowed")
        ) {
          toast.error("Something went wrong. Please try again later.");
          return;
        }

        // Preserve anti-enumeration behavior for all other API-level errors.
        navigate("/forgot-password/sent", { state: { email } });
        return;
      }

      navigate("/forgot-password/sent", { state: { email } });
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <LandingPageHeader onLogin={() => {}} showUserMenu={false} />
      <div className="flex items-center justify-center pt-8 pb-16 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Reset Password
            </h1>
            <p className="text-gray-600">
              Enter your email to receive reset instructions
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Forgot Your Password?</CardTitle>
              <CardDescription>
                No worries! Enter your email address and we'll send you
                instructions to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !email}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm text-gray-600 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
