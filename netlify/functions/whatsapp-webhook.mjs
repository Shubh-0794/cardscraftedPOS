/**
 * Netlify Function: WhatsApp Webhook for Meta Cloud API
 * 
 * Endpoint: /.netlify/functions/whatsapp-webhook
 * 
 * Environment Variables (Set in Netlify Dashboard -> Environment variables):
 * - WHATSAPP_VERIFY_TOKEN (e.g. "cards-crafted-webhook-2026")
 * - VITE_SUPABASE_URL (Optional: for live status updates)
 * - VITE_SUPABASE_PUBLISHABLE_KEY (Optional: for live status updates)
 */

export default async (req, context) => {
  const url = new URL(req.url);
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "cards-crafted-webhook-2026";

  // 1. Meta Webhook Verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log(`[WhatsApp Webhook GET] mode: ${mode}, token: ${token}, expected: ${VERIFY_TOKEN}`);

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[WhatsApp Webhook] Verification successful. Returning challenge.");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    console.warn("[WhatsApp Webhook] Verification failed. Token mismatch or invalid mode.");
    return new Response("Forbidden", { status: 403 });
  }

  // 2. Incoming WhatsApp Events (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("WhatsApp webhook event:", JSON.stringify(body));

      // Parse status updates (sent, delivered, read, failed)
      try {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (value?.statuses && value.statuses.length > 0) {
          const statusObj = value.statuses[0];
          const messageId = statusObj.id;
          const status = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
          const recipientId = statusObj.recipient_id;
          const timestamp = statusObj.timestamp;

          console.log(`[WhatsApp Status Update] Msg: ${messageId}, Status: ${status}, Recipient: ${recipientId}, Time: ${timestamp}`);

          // Optional: Update invoice in Supabase if Supabase credentials exist
          const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

          if (supabaseUrl && supabaseKey && messageId) {
            const mappedStatus = status === 'read' || status === 'delivered' || status === 'sent' ? 'sent' : status === 'failed' ? 'failed' : 'pending';
            
            await fetch(`${supabaseUrl}/rest/v1/invoices?whatsapp_message_id=eq.${encodeURIComponent(messageId)}`, {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                whatsapp_status: mappedStatus,
                whatsapp_error: status === 'failed' ? JSON.stringify(statusObj.errors || 'Delivery failed') : null,
                updated_at: new Date().toISOString()
              })
            }).catch(e => console.warn('[Supabase Webhook Sync Note]', e.message));
          }
        }
      } catch (err) {
        console.warn("[WhatsApp Webhook Processing Note]", err.message);
      }

      // Always return 200 to acknowledge receipt to Meta
      return new Response("EVENT RECEIVED", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    } catch (error) {
      console.error("[WhatsApp Webhook POST Error]", error);
      return new Response("Bad Request", { status: 400 });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};
