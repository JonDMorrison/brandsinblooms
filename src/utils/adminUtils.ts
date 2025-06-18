
// Centralized super admin email management
export const SUPER_ADMIN_EMAILS = [
  "jon@getclear.ca",
  "jeff@brandsinblooms.com"
];

export const isSuperAdmin = (email: string | undefined): boolean => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email);
};
