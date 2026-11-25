import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Lock, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AuthAlert,
  AuthButton,
  AuthCard,
  AuthInput,
  AuthLayout,
  AuthPasswordStrength,
} from "@/components/auth";
import { getAuthErrorMessage } from "@/utils/authErrorMessages";
import { clearBusinessProfileUserIdCache } from "@/lib/profile/businessProfileUserId";
import {
  acceptTeamInvitation,
  createInvitedLogin,
  previewTeamInvitation,
  TeamInvitationError,
  type InvitationPreview,
} from "@/lib/team/teamInvitations";

const MIN_PASSWORD_LENGTH = 8;

const messageFor = (error: unknown) =>
  error instanceof TeamInvitationError ? error.message : "Something went wrong. Try again.";

// Joining a team changes the signed-in user's business, which every
// tenant-scoped cache was loaded for. Like sign-in, finish with a full
// navigation so the app starts in the new business.
const enterApp = () => {
  clearBusinessProfileUserIdCache();
  window.location.href = "/dashboard";
};

const InviteAcceptPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { user, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setPreviewError("This invitation link isn't valid.");
      return;
    }
    let active = true;
    previewTeamInvitation(token)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch((error: unknown) => {
        if (active) setPreviewError(messageFor(error));
      });
    return () => {
      active = false;
    };
  }, [token]);

  const accept = useCallback(async () => {
    setBusy(true);
    setAlert(null);
    try {
      await acceptTeamInvitation(token);
      enterApp();
    } catch (error) {
      setAlert(messageFor(error));
      setBusy(false);
    }
  }, [token]);

  const signInAndAccept = async (event: FormEvent) => {
    event.preventDefault();
    if (!preview) return;
    setBusy(true);
    setAlert(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: preview.email,
      password,
    });
    if (error) {
      setAlert(getAuthErrorMessage(error, "signIn").message);
      setBusy(false);
      return;
    }
    await accept();
  };

  const createLoginAndJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!preview) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setAlert(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }
    if (password !== confirmPassword) {
      setAlert("The passwords don't match.");
      return;
    }
    setBusy(true);
    setAlert(null);
    try {
      await createInvitedLogin(token, password, fullName.trim());
    } catch (error) {
      setAlert(messageFor(error));
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: preview.email,
      password,
    });
    if (error) {
      // The login exists and has joined the team; only the sign-in failed.
      setAlert("Your login is ready. Sign in to continue.");
      setBusy(false);
      window.location.href = "/auth#signin";
      return;
    }
    enterApp();
  };

  const header = (title: string, copy: string, danger = false) => (
    <div className="auth-reset-header">
      {danger ? (
        <AlertTriangle className="auth-reset-icon auth-reset-icon--danger" aria-hidden="true" />
      ) : (
        <Users className="auth-reset-icon auth-reset-icon--secure" aria-hidden="true" />
      )}
      <h1 className="auth-reset-heading">{title}</h1>
      <p className="auth-reset-copy">{copy}</p>
    </div>
  );

  const alertBlock = alert ? (
    <AuthAlert variant="error" autoDismissMs={0} onDismiss={() => setAlert(null)}>
      {alert}
    </AuthAlert>
  ) : null;

  const renderBody = () => {
    if (previewError) {
      return (
        <div className="auth-reset-content">
          {header("Invitation not found", previewError, true)}
          <div className="auth-reset-actions">
            <AuthButton href="/auth#signin">Go to sign in</AuthButton>
          </div>
        </div>
      );
    }

    if (!preview || authLoading) {
      return (
        <div className="auth-reset-state auth-reset-state--loading" role="status" aria-live="polite">
          <span className="auth-reset-spinner" aria-hidden="true" />
          <p className="auth-reset-status">Checking your invitation...</p>
        </div>
      );
    }

    if (preview.state !== "valid") {
      const copy =
        preview.state === "expired"
          ? `This invitation to ${preview.businessName} has expired. Ask for a new one.`
          : preview.state === "revoked"
            ? `This invitation to ${preview.businessName} was cancelled.`
            : `This invitation has already been used. Sign in as ${preview.email} to continue.`;
      return (
        <div className="auth-reset-content">
          {header(preview.state === "accepted" ? "Already accepted" : "Invitation unavailable", copy, preview.state !== "accepted")}
          <div className="auth-reset-actions">
            <AuthButton href={preview.state === "accepted" ? "/dashboard" : "/auth#signin"}>
              {preview.state === "accepted" ? "Go to BloomSuite" : "Go to sign in"}
            </AuthButton>
          </div>
        </div>
      );
    }

    const intro = `You're invited to join ${preview.businessName} on BloomSuite as ${preview.roleLabel}.`;

    if (user) {
      const matches = (user.email ?? "").toLowerCase() === preview.email;
      return (
        <div className="auth-reset-content">
          {header(`Join ${preview.businessName}`, intro)}
          {alertBlock}
          {matches ? (
            <div className="auth-reset-actions">
              <AuthButton loading={busy} onClick={() => void accept()}>
                Join the team
              </AuthButton>
            </div>
          ) : (
            <>
              <AuthAlert variant="info" autoDismissMs={0}>
                You're signed in as {user.email}. This invitation is for {preview.email}.
              </AuthAlert>
              <div className="auth-reset-actions">
                {/* Stay on this page (AuthContext.signOut redirects to /auth). */}
                <AuthButton variant="secondary" onClick={() => void supabase.auth.signOut()}>
                  Sign out
                </AuthButton>
              </div>
            </>
          )}
        </div>
      );
    }

    if (preview.hasAccount) {
      return (
        <div className="auth-reset-content">
          {header(`Join ${preview.businessName}`, `${intro} Sign in to accept.`)}
          {alertBlock}
          <form className="auth-reset-form" onSubmit={(event) => void signInAndAccept(event)} noValidate>
            <AuthInput id="invite-email" label="Email" type="email" value={preview.email} readOnly disabled />
            <AuthInput
              id="invite-password"
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              icon={<Lock aria-hidden="true" />}
              autoComplete="current-password"
              passwordToggleTabIndex={0}
              disabled={busy}
              required
            />
            <AuthButton type="submit" loading={busy} disabled={!password}>
              Sign in and join
            </AuthButton>
            <AuthButton href="/forgot-password" variant="ghost">
              Forgot your password?
            </AuthButton>
          </form>
        </div>
      );
    }

    return (
      <div className="auth-reset-content">
        {header(`Join ${preview.businessName}`, `${intro} Create your login to accept.`)}
        {alertBlock}
        <form className="auth-reset-form" onSubmit={(event) => void createLoginAndJoin(event)} noValidate>
          <AuthInput id="invite-email" label="Email" type="email" value={preview.email} readOnly disabled />
          <AuthInput
            id="invite-name"
            label="Your name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            icon={<User aria-hidden="true" />}
            autoComplete="name"
            disabled={busy}
          />
          <div>
            <AuthInput
              id="invite-new-password"
              label="Password"
              type="password"
              placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              icon={<Lock aria-hidden="true" />}
              autoComplete="new-password"
              passwordToggleTabIndex={0}
              minLength={MIN_PASSWORD_LENGTH}
              disabled={busy}
              required
            />
            <AuthPasswordStrength password={password} />
          </div>
          <AuthInput
            id="invite-confirm-password"
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            icon={<Lock aria-hidden="true" />}
            autoComplete="new-password"
            passwordToggleTabIndex={0}
            disabled={busy}
            required
          />
          <AuthButton type="submit" loading={busy} disabled={!password || !confirmPassword}>
            Create login and join
          </AuthButton>
        </form>
      </div>
    );
  };

  return (
    <AuthLayout>
      <AuthCard>{renderBody()}</AuthCard>
    </AuthLayout>
  );
};

export default InviteAcceptPage;
