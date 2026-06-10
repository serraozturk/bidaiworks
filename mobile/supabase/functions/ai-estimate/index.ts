// Supabase Edge Function: ai-estimate
// Mirrors the Anthropic Claude prompt used by the Next.js web app's
// /api/ai-estimate route. Both web and mobile call the same logic so
// estimates stay consistent.
//
// Deploy:
//   supabase functions deploy ai-estimate --project-ref <YOUR_REF>
//   supabase secrets set ANTHROPIC_API_KEY=sk-... ANTHROPIC_MODEL=claude-haiku-4-5-20251001
//
// The function requires a logged-in Supabase user (verify_jwt = true) so the
// AI key cannot be drained anonymously.
//
// deno-lint-ignore-file no-explicit-any

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const SYSTEM_PROMPT =
  "You are an experienced US home renovation cost estimator with current knowledge of regional labor and material rates. You produce realistic, conservative cost ranges and structured breakdowns. Always respond with a single JSON object and nothing else.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QUALITY_DESC: Record<string, string> = {
  budget: "budget — entry-level fixtures, big-box store materials",
  standard: "standard — mid-range, mainstream brands, semi-custom work",
  premium: "premium — high-end finishes, custom work, designer fixtures",
};

const SCOPE_DESC: Record<string, string> = {
  full_remodel: "full remodel (gut and rebuild everything)",
  partial_remodel: "partial remodel (keep some elements, replace others)",
  repair: "repair only (fix what is broken, no scope expansion)",
  new_install: "net-new build (no existing structure to demo)",
};

function buildUserPrompt(input: any) {
  const lines: string[] = [
    "Estimate the total cost range (USD) for this US home renovation project.",
    "",
    `Category: ${input.categoryName}`,
    `ZIP code: ${input.zipCode} (use this to apply a regional cost-of-labor multiplier)`,
  ];
  if (input.squareFootage) {
    lines.push(`Approximate size: ${input.squareFootage} sq ft`);
  }
  if (input.qualityLevel && QUALITY_DESC[input.qualityLevel]) {
    lines.push(`Quality level: ${QUALITY_DESC[input.qualityLevel]}`);
  }
  if (input.projectScope && SCOPE_DESC[input.projectScope]) {
    lines.push(`Project scope: ${SCOPE_DESC[input.projectScope]}`);
  }
  if (input.materialPreferences) {
    lines.push(`Material preferences: ${input.materialPreferences}`);
  }
  lines.push("", `Project description: ${input.description}`, "");
  lines.push(
    "Produce a realistic range covering the middle 80% of likely outcomes for this region. Include a structured breakdown so the homeowner can see where the money goes. Do NOT pad ranges to be safe — give a tight, well-reasoned estimate.",
    "",
    "Respond with ONLY this JSON shape (no markdown, no prose around it):",
    "{",
    '  "min": <number>,',
    '  "max": <number>,',
    '  "breakdown": {',
    '    "labor": <number — midpoint estimate>,',
    '    "materials": <number — midpoint estimate>,',
    '    "permits_and_overhead": <number>,',
    '    "contingency": <number>',
    "  },",
    '  "reasoning": "<2-3 sentence plain-English explanation>"',
    "}",
  );
  return lines.join("\n");
}

const HEURISTIC_BASE: Record<string, [number, number]> = {
  "Kitchen Remodel": [15000, 60000],
  "Bathroom Remodel": [8000, 30000],
  "Roofing": [6000, 20000],
  "Flooring": [3000, 15000],
  "Interior / Exterior Paint": [2000, 8000],
  "Windows & Doors": [4000, 18000],
  "Plumbing": [500, 8000],
  "Electrical": [500, 10000],
  "HVAC": [4000, 14000],
};

function heuristicFallback(input: any, note?: string) {
  const r = HEURISTIC_BASE[input.categoryName] ?? [3000, 12000];
  return {
    min: r[0],
    max: r[1],
    reasoning: note ??
      "Heuristic fallback (Claude unavailable). Range is based on typical US averages.",
    breakdown: {
      labor: Math.round(((r[0] + r[1]) / 2) * 0.45),
      materials: Math.round(((r[0] + r[1]) / 2) * 0.4),
      permits_and_overhead: Math.round(((r[0] + r[1]) / 2) * 0.05),
      contingency: Math.round(((r[0] + r[1]) / 2) * 0.1),
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  if (!body.categoryName || !body.zipCode || !body.description) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
  if (!/^\d{5}$/.test(body.zipCode)) {
    return new Response(
      JSON.stringify({ error: "Invalid ZIP" }),
      { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify(heuristicFallback(body)), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-4-5-20251001";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 768,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(body) }],
      }),
    });
    const json = await r.json();
    const text = (json?.content ?? [])
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/, "")
      .trim();

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify(
          heuristicFallback(body, "AI response was not valid JSON; using heuristic fallback."),
        ),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    if (typeof parsed?.min !== "number" || typeof parsed?.max !== "number") {
      return new Response(
        JSON.stringify(
          heuristicFallback(body, "AI response was missing fields; using heuristic fallback."),
        ),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    const out = {
      min: Math.max(0, Math.round(parsed.min)),
      max: Math.max(parsed.min, Math.round(parsed.max)),
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      breakdown: parsed.breakdown
        ? {
          labor: Math.max(0, Math.round(Number(parsed.breakdown.labor) || 0)),
          materials: Math.max(0, Math.round(Number(parsed.breakdown.materials) || 0)),
          permits_and_overhead: Math.max(
            0,
            Math.round(Number(parsed.breakdown.permits_and_overhead) || 0),
          ),
          contingency: Math.max(0, Math.round(Number(parsed.breakdown.contingency) || 0)),
        }
        : undefined,
    };

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify(heuristicFallback(body, String(e))), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
