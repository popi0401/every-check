import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Auto-join the default group
        const { data: group } = await supabase
          .from("groups")
          .select("id")
          .limit(1)
          .single();

        if (group) {
          await supabase
            .from("group_members")
            .upsert(
              { group_id: group.id, user_id: user.id },
              { ignoreDuplicates: true }
            );
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
