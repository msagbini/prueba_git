import { NextResponse } from "next/server";
import { hasValidEmailDomain } from "@/lib/validateEmail";

// TODO (production): forward the email to a real mailing list provider
// (e.g. Mailchimp, Klaviyo, Resend Audiences) and trigger the welcome /
// discount-code email. This stub validates and confirms the signup so the
// capture form is fully wired up ahead of choosing a provider.
export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!(await hasValidEmailDomain(email))) {
    return NextResponse.json(
      { error: "That email domain doesn't look valid - check for typos." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
