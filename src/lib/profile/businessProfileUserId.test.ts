import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, getSession } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc, auth: { getSession } },
}));

import {
  clearBusinessProfileUserIdCache,
  getBusinessProfileUserId,
} from "@/lib/profile/businessProfileUserId";
import { resolveBusinessProfileUserId } from "../../../supabase/functions/_shared/businessProfileUserId.ts";

const signedInAs = (id: string) =>
  getSession.mockResolvedValue({ data: { session: { user: { id } } } });

describe("getBusinessProfileUserId", () => {
  beforeEach(() => {
    clearBusinessProfileUserIdCache();
    rpc.mockReset();
    getSession.mockReset();
  });

  it("returns the business owner's id for a teammate", async () => {
    signedInAs("teammate");
    rpc.mockResolvedValue({ data: "owner", error: null });

    await expect(getBusinessProfileUserId("teammate")).resolves.toBe("owner");
    expect(rpc).toHaveBeenCalledWith("current_profile_user_id");
  });

  it("returns the user's own id for a single-user business", async () => {
    signedInAs("owner");
    rpc.mockResolvedValue({ data: "owner", error: null });

    await expect(getBusinessProfileUserId("owner")).resolves.toBe("owner");
  });

  it("resolves once per user", async () => {
    signedInAs("teammate");
    rpc.mockResolvedValue({ data: "owner", error: null });

    await getBusinessProfileUserId("teammate");
    await getBusinessProfileUserId("teammate");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("falls back to the given id when the lookup fails, and retries later", async () => {
    signedInAs("teammate");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    rpc.mockResolvedValueOnce({ data: "owner", error: null });

    await expect(getBusinessProfileUserId("teammate")).resolves.toBe("teammate");
    await expect(getBusinessProfileUserId("teammate")).resolves.toBe("owner");
  });

  it("uses any id other than the signed-in user's as given", async () => {
    signedInAs("admin");

    await expect(getBusinessProfileUserId("someone-else")).resolves.toBe("someone-else");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("resolveBusinessProfileUserId (edge functions)", () => {
  it("returns the resolved id", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: "owner", error: null }) };

    await expect(resolveBusinessProfileUserId(client, "teammate")).resolves.toBe("owner");
    expect(client.rpc).toHaveBeenCalledWith("profile_user_id_for", { p_user_id: "teammate" });
  });

  it("falls back to the given id on error or a thrown call", async () => {
    const failing = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "denied" } }) };
    const throwing = { rpc: vi.fn().mockRejectedValue(new Error("network")) };

    await expect(resolveBusinessProfileUserId(failing, "u1")).resolves.toBe("u1");
    await expect(resolveBusinessProfileUserId(throwing, "u2")).resolves.toBe("u2");
  });
});
