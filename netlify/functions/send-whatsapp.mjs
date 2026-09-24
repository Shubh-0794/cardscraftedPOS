/**
 * Netlify Function: Send WhatsApp Message / Invoice PDF via Meta WhatsApp Cloud API
 * 
 * Endpoint: /.netlify/functions/send-whatsapp
 * 
 * Environment Variables (Set in Netlify Dashboard -> Environment variables):
 * - WHATSAPP_ACCESS_TOKEN (Permanent or System User Access Token from Meta)
 * - WHATSAPP_PHONE_NUMBER_ID (From WhatsApp Business Platform -> API Setup)
 * - WHATSAPP_API_VERSION (e.g. "v20.0" or "v21.0", defaults to "v20.0")
 * - WHATSAPP_TEMPLATE_NAME (Optional: Approved utility template name, default "order_invoice")
 */

export default async (req, context) => {
  // Allow CORS for POS App
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON request body" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const {
      phone,
      customerName = "Customer",
      orderNumber = "ORDER",
      total = 0,
      documentUrl,
      filename = "Invoice.pdf",
      message,
      useTemplate = false,
      templateName = process.env.WHATSAPP_TEMPLATE_NAME || "order_invoice",
      languageCode = "en"
    } = body || {};

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient phone number is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Format Indian mobile number to E.164 without '+' (e.g., 919876543210)
    let cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    } else if (cleanPhone.startsWith("0") && cleanPhone.length === 11) {
      cleanPhone = `91${cleanPhone.slice(1)}`;
    }

    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v20.0";

    if (!token || !phoneNumberId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "WhatsApp Cloud API credentials not configured in Netlify environment variables (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID missing)."
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const graphApiUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    let payload;

    // 1. Template-based message with attached PDF (Meta Cloud API Standard for business-initiated chats)
    if (useTemplate) {
      const components = [];

      // Header component with document PDF if documentUrl is provided
      if (documentUrl) {
        components.push({
          type: "header",
          parameters: [
            {
              type: "document",
              document: {
                link: documentUrl,
                filename: filename || `${orderNumber}.pdf`
              }
            }
          ]
        });
      }

      // Body component parameters (1: Customer Name, 2: Order Number, 3: Total)
      components.push({
        type: "body",
        parameters: [
          { type: "text", text: String(customerName || "Customer") },
          { type: "text", text: String(orderNumber || "INV") },
          { type: "text", text: String(total || "0") }
        ]
      });

      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components
        }
      };
    } else if (documentUrl) {
      // 2. Direct Document message with Caption
      const defaultCaption = message || 
        `Hi ${customerName} 👋\nThank you for your order from Cards Crafted ❤️\n\nYour invoice #${orderNumber} is attached.\nAmount: ₹${total}\n\nThank you for supporting Cards Crafted!`;

      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "document",
        document: {
          link: documentUrl,
          caption: defaultCaption,
          filename: filename || `${orderNumber}.pdf`
        }
      };
    } else {
      // 3. Fallback text message if no document URL
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: {
          preview_url: true,
          body: message || `Thank you for your order #${orderNumber} from Cards Crafted!`
        }
      };
    }

    // Call Meta WhatsApp Cloud API
    const response = await fetch(graphApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[Netlify WhatsApp Function Error]", result);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error?.message || result.error || "Failed to send WhatsApp message via Meta Cloud API",
          details: result
        }),
        { status: response.status || 500, headers: corsHeaders }
      );
    }

    const messageId = result.messages?.[0]?.id;

    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        whatsapp: result
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("[Netlify WhatsApp Function Exception]", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error"
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};
