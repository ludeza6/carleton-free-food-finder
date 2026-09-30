import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const VALID_QUANTITIES = ["lots", "some", "almost_gone"];

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("food_reports")
    .select("*")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load reports" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid report body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const limits = { building: 120, room: 80, food_type: 120, notes: 1000 };

  for (const [field, maxLength] of Object.entries(limits)) {
    const value = input[field];
    if (value == null) continue;
    if (typeof value !== "string") {
      return NextResponse.json(
        { error: `${field} must be a string` },
        { status: 400 },
      );
    }
    if (value.trim().length > maxLength) {
      return NextResponse.json(
        { error: `${field} must be at most ${maxLength} characters` },
        { status: 400 },
      );
    }
  }

  const building = (input.building as string | null | undefined)?.trim();
  const room = (input.room as string | null | undefined)?.trim() || null;
  const foodType = (input.food_type as string | null | undefined)?.trim();
  const quantity = typeof input.quantity === "string" ? input.quantity.trim() : "";
  const notes = (input.notes as string | null | undefined)?.trim() || null;

  if (!building || !foodType) {
    return NextResponse.json(
      { error: "Building and food type are required" },
      { status: 400 },
    );
  }

  if (!VALID_QUANTITIES.includes(quantity)) {
    return NextResponse.json(
      { error: "Invalid quantity" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const expiresAt = new Date(
    Date.now() + 2 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("food_reports")
    .insert({
      building,
      room,
      food_type: foodType,
      quantity,
      notes,
      status: "active",
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to submit report" },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
