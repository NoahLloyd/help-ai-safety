import { createClient } from "@supabase/supabase-js";
import { sendMagicLinkEmail } from "@/lib/email";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service role key");
  }
  return createClient(url, key);
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://howdoihelp.ai";
}

export async function POST(req: Request) {
  try {
    const { email, redirectTo } = (await req.json()) as {
      email?: string;
      redirectTo?: string;
    };

    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Valid email required" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const base = getBaseUrl();
    const callbackUrl = `${base}${redirectTo || "/auth/callback?next=/dashboard"}`;

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email.trim(),
      options: { redirectTo: callbackUrl },
    });

    if (error) {
      console.error("[magic-link] generateLink error:", error);
      return Response.json({ error: "Failed to generate link" }, { status: 500 });
    }

    const actionLink = data.properties.action_link;

    await sendMagicLinkEmail(email.trim(), actionLink);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[magic-link] Error:", err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
