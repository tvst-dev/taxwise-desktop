import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Exchange rates to NGN
const EXCHANGE_RATES: Record<string, number> = {
  NGN: 1, USD: 1550, EUR: 1680, GBP: 1950, CAD: 1120, AUD: 1010,
  JPY: 10.5, CNY: 215, INR: 18.5, ZAR: 85, GHS: 95, KES: 12,
  AED: 422, SAR: 413, CHF: 1750, SGD: 1150, HKD: 198, MYR: 345
};

const SYSTEM_PROMPT = `You are a financial document extraction engine. Extract data accurately.

STRICT RULES:
1. Return ONLY valid JSON. No markdown, no explanation, no code blocks.
2. Follow the schema exactly.
3. If a field is not found, use null.
4. Never guess - extract exactly what is written.
5. Dates: YYYY-MM-DD format.
6. Amounts: numbers only, no currency symbols or commas.
7. Currency detection: $ = USD, € = EUR, £ = GBP, ₦ = NGN, R = ZAR
8. total_amount/total: Find "Amount due", "Total", "Balance Due", "Grand Total" - the FINAL payable amount.
9. NEVER use discount lines or line items as the total.
10. entry_type: "expense" for invoices/receipts/bills, "income" for payslips/payments received.`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return jsonResponse({ error: "OpenAI API key not configured" }, 500);
    }

    // Parse request
    const { imageBase64, mimeType, documentType } = await req.json();
    if (!imageBase64) {
      return jsonResponse({ error: "No file data provided" }, 400);
    }

    const mime = (mimeType || "image/jpeg").toLowerCase();
    console.log(`Processing document - Type: ${documentType}, MIME: ${mime}, Size: ${imageBase64.length} chars`);

    // Build the content array based on file type
    const contentArray = buildContentArray(imageBase64, mime, documentType);
    
    // Call OpenAI
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contentArray }
        ],
        max_tokens: 3000,
        temperature: 0
      }),
    });

    if (!aiResponse.ok) {
      const errData = await aiResponse.json().catch(() => ({}));
      console.error("OpenAI API error:", JSON.stringify(errData));
      return jsonResponse({ 
        error: errData.error?.message || `OpenAI error: ${aiResponse.status}` 
      }, 500);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return jsonResponse({ error: "No response from AI" }, 500);
    }

    console.log("AI Response:", content.substring(0, 800));

    // Parse JSON from response
    const extracted = parseJsonFromResponse(content);
    if (!extracted) {
      return jsonResponse({ error: "Could not parse AI response as JSON", raw: content.substring(0, 500) }, 500);
    }

    // Normalize and convert to NGN
    const normalized = normalizeExtractedData(extracted, documentType);
    const converted = convertToNGN(normalized);

    console.log(`Success - Currency: ${normalized.currency}, Total: ${normalized.total_amount || normalized.total}`);

    return jsonResponse({
      success: true,
      data: converted,
      conversion_info: {
        original_currency: normalized.currency || "NGN",
        converted_to: "NGN",
        exchange_rate: EXCHANGE_RATES[(normalized.currency || "NGN").toUpperCase()] || 1
      }
    });

  } catch (err) {
    console.error("Server error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

/**
 * Build the correct content array based on file type
 * - PDFs use "type": "file" with nested "file" object
 * - Images use "type": "image_url" with "image_url" object
 */
function buildContentArray(base64: string, mimeType: string, documentType: string): unknown[] {
  const prompt = getExtractionPrompt(documentType || "other");
  
  if (mimeType === "application/pdf") {
    // PDF format for Chat Completions API
    return [
      {
        type: "file",
        file: {
          filename: "document.pdf",
          file_data: `data:application/pdf;base64,${base64}`
        }
      },
      {
        type: "text",
        text: prompt
      }
    ];
  } else {
    // Image format for Chat Completions API
    return [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
          detail: "high"
        }
      },
      {
        type: "text",
        text: prompt
      }
    ];
  }
}

function parseJsonFromResponse(content: string): Record<string, unknown> | null {
  try {
    // Clean markdown code blocks if present
    let cleaned = content.trim();
    cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    
    // Find JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    
    return JSON.parse(match[0]);
  } catch (e) {
    console.error("JSON parse error:", e);
    return null;
  }
}

function normalizeExtractedData(data: Record<string, unknown>, documentType: string): Record<string, unknown> {
  const result = { ...data };
  
  // Handle nested "data" structure
  if (result.data && typeof result.data === "object") {
    Object.assign(result, result.data);
    delete result.data;
  }
  
  // Normalize total fields
  if (result.total !== undefined && result.total_amount === undefined) {
    result.total_amount = result.total;
  }
  
  // Set document type if missing
  if (!result.document_type) {
    result.document_type = documentType || "other";
  }
  
  // Set entry_type if missing
  if (!result.entry_type) {
    const docType = String(result.document_type).toLowerCase();
    result.entry_type = (docType === "payslip" || docType === "payment_received") ? "income" : "expense";
  }
  
  return result;
}

function convertToNGN(data: Record<string, unknown>): Record<string, unknown> {
  const currency = String(data.currency || "NGN").toUpperCase();
  const rate = EXCHANGE_RATES[currency] || 1;
  const isNGN = currency === "NGN";

  const result: Record<string, unknown> = {
    ...data,
    original_currency: currency,
    currency: "NGN",
    exchange_rate: rate,
    converted_from_foreign: !isNGN
  };

  // Amount fields to convert
  const amountFields = [
    "total_amount", "total", "subtotal", "tax", "vat_amount", 
    "net_pay", "gross_pay", "amount", "amount_due",
    "basic_salary", "allowances", "total_deductions"
  ];

  for (const field of amountFields) {
    const val = data[field];
    if (typeof val === "number" && val !== 0 && !isNGN) {
      result[`original_${field}`] = val;
      result[field] = Math.round(val * rate * 100) / 100;
    }
  }

  // Convert line items/items arrays
  for (const arrField of ["items", "line_items"]) {
    if (Array.isArray(data[arrField])) {
      result[arrField] = (data[arrField] as Record<string, unknown>[]).map(item => {
        const converted: Record<string, unknown> = { ...item };
        for (const f of ["amount", "unit_price"]) {
          const v = item[f];
          if (typeof v === "number" && v !== 0 && !isNGN) {
            converted[`original_${f}`] = v;
            converted[f] = Math.round(v * rate * 100) / 100;
          }
        }
        return converted;
      });
    }
  }

  return result;
}

function getExtractionPrompt(documentType: string): string {
  const baseInstruction = `Extract ALL data from this document and return ONLY valid JSON.`;
  
  const schemas: Record<string, string> = {
    invoice: `${baseInstruction}

SCHEMA:
{
  "document_type": "invoice",
  "vendor_name": "company issuing invoice",
  "vendor_address": "address if visible",
  "vendor_email": "email if visible",
  "bill_to": "customer/recipient name",
  "invoice_number": "invoice number",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD or null",
  "currency": "USD/EUR/GBP/NGN (detect from $ € £ ₦)",
  "items": [{"description": "item", "quantity": 1, "unit_price": 0.00, "amount": 0.00}],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "entry_type": "expense",
  "category": "software/services/utilities/office/other"
}

CRITICAL: 
- "total" MUST be the final "Amount due" or "Total" at the bottom - the amount to pay
- $ symbol means currency is "USD"
- Example: "$34.35 USD due" → currency: "USD", total: 34.35`,

    receipt: `${baseInstruction}

SCHEMA:
{
  "document_type": "receipt",
  "vendor_name": "store/business name",
  "vendor_address": "address if visible",
  "receipt_number": "receipt number",
  "date": "YYYY-MM-DD",
  "time": "HH:MM or null",
  "currency": "USD/EUR/GBP/NGN",
  "items": [{"description": "item", "quantity": 1, "unit_price": 0.00, "amount": 0.00}],
  "subtotal": 0.00,
  "tax": 0.00,
  "total_amount": 0.00,
  "payment_method": "cash/card/transfer",
  "entry_type": "expense",
  "category": "food/transport/utilities/office/software/services/other"
}`,

    payslip: `${baseInstruction}

SCHEMA:
{
  "document_type": "payslip",
  "employer_name": "company name",
  "employee_name": "employee name",
  "employee_id": "staff ID or null",
  "pay_period": "month/period description",
  "payment_date": "YYYY-MM-DD",
  "currency": "USD/EUR/GBP/NGN",
  "basic_salary": 0.00,
  "allowances": 0.00,
  "gross_pay": 0.00,
  "tax_deduction": 0.00,
  "pension_deduction": 0.00,
  "total_deductions": 0.00,
  "net_pay": 0.00,
  "entry_type": "income",
  "category": "Salary"
}`,

    bank_statement: `${baseInstruction}

SCHEMA:
{
  "document_type": "bank_statement",
  "bank_name": "bank name",
  "account_name": "account holder",
  "account_number": "account number",
  "currency": "USD/EUR/GBP/NGN",
  "statement_start": "YYYY-MM-DD",
  "statement_end": "YYYY-MM-DD",
  "opening_balance": 0.00,
  "closing_balance": 0.00,
  "total_credits": 0.00,
  "total_debits": 0.00
}`,

    other: `${baseInstruction}

Analyze this document and extract financial data.

SCHEMA:
{
  "document_type": "invoice/receipt/bill/payslip/statement/expense",
  "title": "document title or description",
  "vendor_name": "company/vendor name",
  "date": "YYYY-MM-DD",
  "reference_number": "any reference number",
  "currency": "USD/EUR/GBP/NGN (detect: $ = USD, € = EUR, £ = GBP, ₦ = NGN)",
  "items": [{"description": "item or service", "amount": 0.00}],
  "subtotal": 0.00,
  "tax": 0.00,
  "total_amount": 0.00,
  "entry_type": "expense/income",
  "category": "software/services/utilities/office/travel/food/salary/other",
  "description": "brief description of what this document is for"
}

CRITICAL RULES:
- total_amount = the FINAL total (look for "Amount due", "Total", "Balance Due")
- $ symbol = USD currency
- Example: "$34.35 USD due" → currency: "USD", total_amount: 34.35
- NEVER use discount amounts as the total`
  };

  return schemas[documentType] || schemas.other;
}