import { NextResponse } from "next/server";

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

  if (!name || !email || !category) {
    return NextResponse.json(
      { error: "Please fill in your name, email and category." },
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
      hasImage: image instanceof File && image.size > 0,
    },
  });
}
