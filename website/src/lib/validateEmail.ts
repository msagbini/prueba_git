import { resolveMx } from "node:dns/promises";

// Confirms the email's domain actually has mail servers configured, catching
// typos and made-up domains (e.g. "as@nepe.com") that pass basic format
// checks but can never receive mail. It can't confirm the mailbox itself
// exists - only a real send or double opt-in email can do that.
export async function hasValidEmailDomain(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}
