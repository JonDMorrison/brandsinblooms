// List of test account emails that get full access in the client.
// Access is granted by SubscriptionContext (hasPrivilegedAccess); the
// subscription row itself is created server-side at signup and is never
// written from the browser.
const TEST_ACCOUNT_EMAILS = [
  "reviewer+test@brandsinblooms.com",
  "FB_TEST_USER_EMAIL", // This will be replaced with actual test user email
];

export const isTestAccount = (email: string | undefined): boolean => {
  if (!email) return false;
  return TEST_ACCOUNT_EMAILS.includes(email.toLowerCase());
};
