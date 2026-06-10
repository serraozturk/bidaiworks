/**
 * POST /api/ai-estimate
 *
 * Body:
 * {
 *   categoryName,
 *   zipCode,
 *   description,
 *   squareFootage?,
 *   qualityLevel?,
 *   projectScope?,
 *   materialPreferences?,
 *   detailedAnswers?,
 *   zipMaterialSuggestions?
 * }
 *
 * Returns:
 * {
 *   min,
 *   max,
 *   reasoning,
 *   breakdown?
 * }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { generateEstimate } from '@/lib/ai/estimate';

const Body = z.object({
  categoryName: z.string().min(1),
  zipCode: z.string().regex(/^\d{5}$/),
  description: z.string().min(10).max(8000),

  squareFootage: z
    .number()
    .positive()
    .nullable()
    .optional(),

  qualityLevel: z
    .enum(['budget', 'standard', 'premium', 'luxury'])
    .nullable()
    .optional(),

  projectScope: z
    .enum(['full_remodel', 'partial_remodel', 'repair', 'new_install'])
    .nullable()
    .optional(),

  /**
   * Old form sent this as string.
   * New detailed brief sends this as object.
   */
  materialPreferences: z
    .union([
      z.string(),
      z.record(z.any()),
    ])
    .nullable()
    .optional(),

  detailedAnswers: z
    .record(z.any())
    .nullable()
    .optional(),

  zipMaterialSuggestions: z
    .record(z.any())
    .nullable()
    .optional(),
});

export async function POST(req: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 },
    );
  }

  const parsed = Body.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await generateEstimate({
      categoryName: parsed.data.categoryName,
      zipCode: parsed.data.zipCode,
      description: parsed.data.description,
      squareFootage: parsed.data.squareFootage ?? null,
      qualityLevel: parsed.data.qualityLevel ?? null,
      projectScope: parsed.data.projectScope ?? null,
      materialPreferences: parsed.data.materialPreferences ?? null,
      detailedAnswers: parsed.data.detailedAnswers ?? null,
      zipMaterialSuggestions: parsed.data.zipMaterialSuggestions ?? null,
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('ai-estimate error', e);

    return NextResponse.json(
      {
        error: 'Estimate failed',
        detail: e?.message ?? 'unknown',
      },
      { status: 500 },
    );
  }
}