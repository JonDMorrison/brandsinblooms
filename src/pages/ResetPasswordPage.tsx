import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Loader2, Lock, AlertCircle } from "lucide-react";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { getAuthErrorMessage } from "@/utils/errorHandling";
import { useAuth } from "@/contexts/AuthContext";

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { clearRecoveryMode } = useAuth();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // The Supabase client (detectSessionInUrl: true, flowType: "pkce")
    // auto-exchanges the ?code= parameter for a session. We must NOT call
    // exchangeCodeForSession manually — that creates a race condition where
    // both compete to consume the same code and one fails.
    //
    // Instead, listen for auth state changes. When Supabase auto-exchanges
    // successfully it emits PASSWORD_RECOVERY or SIGNED_IN. Either means the
    // session is ready and the user can set a new password.

    let resolved = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (resolved) return;

      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        resolved = true;
        // Clean ?code from URL so it can't be reused / bookmarked
        window.history.replaceState(null, "", "/reset-password");
        setIsValidToken(true);
        return;
      }
    });

    // Fallback: if the session was already established (e.g. auto-exchange
    // finished before this effect ran), check it directly after a tick.
    const fallbackTimer = setTimeout(async () => {
      if (resolved) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        resolved = true;
        window.history.replaceState(null, "", "/reset-password");
        setIsValidToken(true);
      }
    }, 500);

    // Timeout: if neither approach resolves within 8s, mark as invalid.
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setIsValidToken(false);
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setFormError(getAuthErrorMessage(error));
      } else {
        clearRecoveryMode();
        toast.success("Password updated successfully!");

        // Sign out the user after password reset
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Password reset sign-out error:", signOutError);
        }

        // Navigate to login with success message
        navigate("/auth", {
          state: {
            message:
              "Password reset successful. Please sign in with your new password.",
          },
        });
      }
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Verifying your reset link...
          </p>
        </div>
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <LandingPageHeader onLogin={() => {}} showUserMenu={false} />
        <div className="flex items-center justify-center pt-8 pb-16 px-4">
          <div className="w-full max-w-md">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertCircle className="h-5 w-5" />
                  <CardTitle>Invalid or Expired Link</CardTitle>
                </div>
                <CardDescription>
                  This password reset link is invalid or has expired.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Password reset links expire after a certain time for security
                  reasons. Please request a new password reset link to continue.
                </p>
                <Button
                  onClick={() => navigate("/forgot-password")}
                  className="w-full"
                >
                  Request New Reset Link
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <LandingPageHeader onLogin={() => {}} showUserMenu={false} />
      <div className="flex items-center justify-center pt-8 pb-16 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Set New Password
            </h1>
            <p className="text-gray-600">Enter your new password below</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Create New Password</CardTitle>
              <CardDescription>
                Choose a strong password that you haven't used before
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter new password (min 8 characters)"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (formError) {
                          setFormError(null);
                        }
                      }}
                      className="pl-10"
                      disabled={loading}
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (formError) {
                          setFormError(null);
                        }
                      }}
                      className="pl-10"
                      disabled={loading}
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <p>Your password must:</p>
                  <ul className="list-disc list-inside ml-2">
                    <li>Be at least 8 characters long</li>
                    <li>Match the confirmation password</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !password || !confirmPassword}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <button
              onClick={() => navigate("/auth")}
              className="text-sm text-gray-600 hover:underline"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
