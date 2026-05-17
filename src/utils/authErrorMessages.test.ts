import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./authErrorMessages";

describe("getAuthErrorMessage", () => {
  describe("network errors", () => {
    it("maps fetch failures by message", () => {
      const result = getAuthErrorMessage(
        new Error("Failed to fetch"),
        "signIn",
      );
      expect(result.code).toBe("network_error");
      expect(result.retryable).toBe(true);
      expect(result.message).toContain("internet connection");
    });

    it("maps timeout errors by message", () => {
      const result = getAuthErrorMessage(
        new Error("Request timeout"),
        "signIn",
      );
      expect(result.code).toBe("network_error");
    });

    it("maps generic network errors", () => {
      const result = getAuthErrorMessage(
        new Error("Network request failed"),
        "passwordReset",
      );
      expect(result.code).toBe("network_error");
    });

    it("treats network as string error", () => {
      const result = getAuthErrorMessage("Failed to fetch", "signIn");
      expect(result.code).toBe("network_error");
    });
  });

  describe("rate limits", () => {
    it("maps over_request_rate_limit by code", () => {
      const result = getAuthErrorMessage(
        { code: "over_request_rate_limit" },
        "signIn",
      );
      expect(result.code).toBe("over_request_rate_limit");
      expect(result.retryable).toBe(false);
      expect(result.suggestRetryAfterSeconds).toBe(300);
    });

    it("maps 429 status to over_request_rate_limit", () => {
      const result = getAuthErrorMessage(
        { status: 429, message: "Too many requests" },
        "signIn",
      );
      expect(result.code).toBe("over_request_rate_limit");
      expect(result.suggestRetryAfterSeconds).toBe(300);
    });

    it("maps 'too many requests' by message", () => {
      const result = getAuthErrorMessage(
        new Error("Too many requests"),
        "passwordReset",
      );
      expect(result.code).toBe("over_request_rate_limit");
    });

    it("maps over_email_send_rate_limit by code", () => {
      const result = getAuthErrorMessage(
        { code: "over_email_send_rate_limit" },
        "passwordReset",
      );
      expect(result.code).toBe("over_email_send_rate_limit");
      expect(result.message).toContain("5 minutes");
      expect(result.retryable).toBe(false);
      expect(result.suggestRetryAfterSeconds).toBe(300);
    });

    it("maps email rate limit by message", () => {
      const result = getAuthErrorMessage(
        new Error("Email rate limit exceeded"),
        "passwordReset",
      );
      expect(result.code).toBe("over_email_send_rate_limit");
    });
  });

  describe("user_banned", () => {
    it("maps user_banned by code", () => {
      const result = getAuthErrorMessage({ code: "user_banned" }, "signIn");
      expect(result.code).toBe("user_banned");
      expect(result.message).toContain("support@brandsinblooms.com");
      expect(result.retryable).toBe(false);
    });

    it("maps user_banned when banned_until is present on object", () => {
      const result = getAuthErrorMessage(
        { banned_until: "2030-01-01T00:00:00Z", message: "" },
        "signIn",
      );
      expect(result.code).toBe("user_banned");
    });

    it("maps user_banned by message", () => {
      const result = getAuthErrorMessage(
        new Error("Account suspended"),
        "signIn",
      );
      expect(result.code).toBe("user_banned");
    });
  });

  describe("email_not_confirmed", () => {
    it("maps email_not_confirmed by code", () => {
      const result = getAuthErrorMessage(
        { code: "email_not_confirmed" },
        "signIn",
      );
      expect(result.code).toBe("email_not_confirmed");
      expect(result.message).toContain("confirm your email");
      expect(result.message).toContain("spam");
      expect(result.retryable).toBe(true);
    });

    it("maps email_not_confirmed by 422 + message", () => {
      const result = getAuthErrorMessage(
        { status: 422, message: "Email not confirmed" },
        "signIn",
      );
      expect(result.code).toBe("email_not_confirmed");
    });

    it("maps email_not_confirmed by message alone", () => {
      const result = getAuthErrorMessage(
        new Error("Email not confirmed"),
        "signIn",
      );
      expect(result.code).toBe("email_not_confirmed");
    });
  });

  describe("captcha_failed", () => {
    it("maps captcha_failed by code", () => {
      const result = getAuthErrorMessage(
        { code: "captcha_failed" },
        "signIn",
      );
      expect(result.code).toBe("captcha_failed");
      expect(result.retryable).toBe(true);
    });

    it("maps captcha by message", () => {
      const result = getAuthErrorMessage(
        new Error("Captcha verification failed"),
        "signIn",
      );
      expect(result.code).toBe("captcha_failed");
    });
  });

  describe("weak_password (context-gated)", () => {
    it("maps weak_password by code in signUp context", () => {
      const result = getAuthErrorMessage(
        { code: "weak_password" },
        "signUp",
      );
      expect(result.code).toBe("weak_password");
      expect(result.retryable).toBe(true);
    });

    it("maps weak_password by message in passwordUpdate context", () => {
      const result = getAuthErrorMessage(
        new Error("Password should be at least 8 characters"),
        "passwordUpdate",
      );
      expect(result.code).toBe("weak_password");
    });

    it("does NOT map weak_password in signIn context", () => {
      const result = getAuthErrorMessage(
        new Error("Password should be at least 8 characters"),
        "signIn",
      );
      expect(result.code).not.toBe("weak_password");
    });

    it("does NOT map weak_password in passwordReset context", () => {
      const result = getAuthErrorMessage(
        { code: "weak_password" },
        "passwordReset",
      );
      expect(result.code).not.toBe("weak_password");
    });
  });

  describe("same_password (passwordUpdate only)", () => {
    it("maps same_password by code", () => {
      const result = getAuthErrorMessage(
        { code: "same_password" },
        "passwordUpdate",
      );
      expect(result.code).toBe("same_password");
      expect(result.message).toContain("different");
      expect(result.retryable).toBe(true);
    });

    it("maps same_password by message", () => {
      const result = getAuthErrorMessage(
        new Error("New password should be different from the old password"),
        "passwordUpdate",
      );
      expect(result.code).toBe("same_password");
    });

    it("does NOT map same_password in signIn context", () => {
      const result = getAuthErrorMessage(
        { code: "same_password" },
        "signIn",
      );
      expect(result.code).not.toBe("same_password");
    });
  });

  describe("signup_disabled (signUp only)", () => {
    it("maps signup_disabled by code in signUp context", () => {
      const result = getAuthErrorMessage(
        { code: "signup_disabled" },
        "signUp",
      );
      expect(result.code).toBe("signup_disabled");
      expect(result.retryable).toBe(false);
    });

    it("maps signup_disabled by message", () => {
      const result = getAuthErrorMessage(
        new Error("Signups are disabled"),
        "signUp",
      );
      expect(result.code).toBe("signup_disabled");
    });

    it("does NOT map signup_disabled in signIn context", () => {
      const result = getAuthErrorMessage(
        { code: "signup_disabled" },
        "signIn",
      );
      expect(result.code).not.toBe("signup_disabled");
    });
  });

  describe("user_already_registered (signUp only)", () => {
    it("maps user_already_registered by code in signUp context", () => {
      const result = getAuthErrorMessage(
        { code: "user_already_registered" },
        "signUp",
      );
      expect(result.code).toBe("user_already_registered");
      expect(result.message).toContain("already exists");
      expect(result.retryable).toBe(true);
    });

    it("maps user_already_exists code variant", () => {
      const result = getAuthErrorMessage(
        { code: "user_already_exists" },
        "signUp",
      );
      expect(result.code).toBe("user_already_registered");
    });

    it("maps email_exists code variant", () => {
      const result = getAuthErrorMessage(
        { code: "email_exists" },
        "signUp",
      );
      expect(result.code).toBe("user_already_registered");
    });

    it("maps 'user already registered' by message in signUp context", () => {
      const result = getAuthErrorMessage(
        new Error("User already registered"),
        "signUp",
      );
      expect(result.code).toBe("user_already_registered");
    });

    it("does NOT map user_already_registered in signIn context", () => {
      const result = getAuthErrorMessage(
        { code: "user_already_registered" },
        "signIn",
      );
      expect(result.code).not.toBe("user_already_registered");
    });
  });

  describe("invalid_credentials (signIn only)", () => {
    it("maps invalid_credentials by code in signIn", () => {
      const result = getAuthErrorMessage(
        { code: "invalid_credentials", message: "bad creds" },
        "signIn",
      );
      expect(result.code).toBe("invalid_credentials");
      expect(result.message).toContain("Email or password is incorrect");
      expect(result.message).toContain("Sign in with Google");
      expect(result.retryable).toBe(true);
    });

    it("maps 'Invalid login credentials' by message", () => {
      const result = getAuthErrorMessage(
        new Error("Invalid login credentials"),
        "signIn",
      );
      expect(result.code).toBe("invalid_credentials");
    });

    it("does NOT map invalid_credentials in signUp context", () => {
      const result = getAuthErrorMessage(
        { code: "invalid_credentials" },
        "signUp",
      );
      expect(result.code).not.toBe("invalid_credentials");
    });

    it("does NOT map invalid_credentials in passwordReset context", () => {
      const result = getAuthErrorMessage(
        new Error("Invalid login credentials"),
        "passwordReset",
      );
      expect(result.code).not.toBe("invalid_credentials");
    });
  });

  describe("validation_failed", () => {
    it("maps validation_failed by code", () => {
      const result = getAuthErrorMessage(
        { code: "validation_failed" },
        "signUp",
      );
      expect(result.code).toBe("validation_failed");
      expect(result.retryable).toBe(true);
    });

    it("maps validation_failed by message", () => {
      const result = getAuthErrorMessage(
        new Error("Email validation failed"),
        "signUp",
      );
      expect(result.code).toBe("validation_failed");
    });
  });

  describe("provider_disabled", () => {
    it("maps provider_disabled by code", () => {
      const result = getAuthErrorMessage(
        { code: "provider_disabled" },
        "oauth",
      );
      expect(result.code).toBe("provider_disabled");
      expect(result.retryable).toBe(false);
    });

    it("maps provider_disabled by message", () => {
      const result = getAuthErrorMessage(
        new Error("OAuth provider disabled"),
        "oauth",
      );
      expect(result.code).toBe("provider_disabled");
    });
  });

  describe("unknown fallback", () => {
    it("falls back for unrecognised errors", () => {
      const result = getAuthErrorMessage(
        new Error("Something weird happened on the server"),
        "signIn",
      );
      expect(result.code).toBe("unknown");
      expect(result.message).toContain("Something went wrong");
      expect(result.message).toContain("contact support");
      expect(result.retryable).toBe(true);
    });

    it("falls back for null input", () => {
      expect(getAuthErrorMessage(null, "signIn").code).toBe("unknown");
    });

    it("falls back for undefined input", () => {
      expect(getAuthErrorMessage(undefined, "signIn").code).toBe("unknown");
    });

    it("falls back for empty object input", () => {
      expect(getAuthErrorMessage({}, "signIn").code).toBe("unknown");
    });

    it("falls back for an object with no recognised fields", () => {
      const result = getAuthErrorMessage(
        { foo: "bar", baz: 42 },
        "passwordUpdate",
      );
      expect(result.code).toBe("unknown");
    });
  });
});
