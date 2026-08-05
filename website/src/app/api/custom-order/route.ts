import { NextResponse } from "next/server";
import { hasValidEmailDomain } from "@/lib/validateEmail";

// TODO (production): forward the parsed fields + uploaded file to persistent
// storage (e.g. S3/Cloudinary) and notify Grace by email (e.g. Resend/Postmark).
// This stub validates the submission and confirms receipt so the form is
// fully wired up on the frontend ahead of choosing those providers.
export async function POST(request: Request) {
  const formData = await request.formData();

  const name = formData.get("name");
  const email = formData.get("email");
  const category = formData.get("category");
  const message = formData.get("message");
  const image = formData.get("image");
  const shape = formData.get("shape");
  const character = formData.get("character");
  const color = formData.get("color");
  const eventDate = formData.get("eventDate");
  const fulfillment = formData.get("fulfillment");
  const suburb = formData.get("suburb");
  const postcode = formData.get("postcode");

  if (!name || !email || !category) {
    return NextResponse.json(
      { error: "Please fill in your name, email and category." },
      { status: 400 },
    );
  }

  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !(await hasValidEmailDomain(email))
  ) {
    return NextResponse.json(
      { error: "That email address doesn't look valid - check for typos." },
      { status: 400 },
    );
  }

  if (fulfillment === "delivery" && (!suburb || !postcode)) {
    return NextResponse.json(
      { error: "Please add a suburb and postcode so we can quote delivery." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    received: {
      name,
      email,
      category,
      message,
      shape,
      character,
      color,
      eventDate,
      fulfillment,
      suburb,
      postcode,
      hasImage: image instanceof File && image.size > 0,
    },
  });
}
