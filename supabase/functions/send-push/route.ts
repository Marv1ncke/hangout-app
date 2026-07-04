import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

const VAPID_PUBLIC_KEY = "BKvey2M6TzhvKHtQ3YVU3YUAPBooy_NWLBPIk9L-YQamVKmokKg6p8pOzrpeuzQ0ZVyCeepsfAgStLUpmeWs8Cc";
const VAPID_PRIVATE_KEY = "FEX0n9MVDbEOxNIFWm5QvKhpjj-HxazMQ5ayVnOe-iU";

webpush.setVapidDetails(
  "mailto:your-email@example.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export async function POST(request: Request) {
  try {
    const { record } = await request.json();
    if (!record) return NextResponse.json({ error: "No record found" }, { status: 400 });

    // Initialiseer Supabase Admin via de omgevingsvariabelen die al in Vercel staan
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Zorg dat deze in je Vercel settings staat!
    );

    // Haal groepsleden op (behalve de betaler)
    const { data: members } = await supabaseAdmin
      .from("group_members")
      .select("user_id")
      .eq("group_id", record.group_id)
      .eq("status", "active")
      .not("user_id", "eq", record.payer_id);

    if (!members || members.length === 0) {
      return NextResponse.json({ message: "No other members to notify" });
    }

    const userIds = members.map((m) => m.user_id);

    // Haal push-abonnementen op
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription")
      .in("user_id", userIds);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: "No subscriptions found" });
    }

    const payload = JSON.stringify({
      title: "💸 Nieuwe Uitgave!",
      body: `Er is een nieuwe kostenpost toegevoegd: "${record.description}" voor €${Number(record.amount).toFixed(2)}.`,
      url: "/expenses",
    });

    const pushPromises = subscriptions.map((sub: any) =>
      webpush.sendNotification(sub.subscription, payload).catch((err) => console.error(err))
    );

    await Promise.all(pushPromises);

    return NextResponse.json({ success: true, notified: subscriptions.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}