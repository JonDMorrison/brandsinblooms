/** Synthetic demonstration tenant: no authentication or customer credentials. */
export function useTenant() {
  return {
    tenant: {
      id: "synthetic-intelligence-tenant",
      settings: { timezone: "America/Vancouver" },
    },
  };
}
