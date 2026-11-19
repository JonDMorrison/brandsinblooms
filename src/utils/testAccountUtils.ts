// List of test account emails that should have PRO access
const TEST_ACCOUNT_EMAILS = [
  "reviewer+test@brandsinblooms.com",
  "FB_TEST_USER_EMAIL", // This will be replaced with actual test user email
];

export const isTestAccount = (email: string | undefined): boolean => {
  if (!email) return false;
  return TEST_ACCOUNT_EMAILS.includes(email.toLowerCase());
};
