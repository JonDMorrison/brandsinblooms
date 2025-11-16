
// DEPRECATED: Use the useIsSuperAdmin hook instead
// This ensures the database (app_admin_emails table) is the single source of truth
// Keeping this for backwards compatibility only
export const SUPER_ADMIN_EMAILS = [
  "jon@getclear.ca",
  "jeff@brandsinblooms.com"
];

// DEPRECATED: Use the useIsSuperAdmin hook instead
export const isSuperAdmin = (email: string | undefined): boolean => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email);
};
