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
  const body = await request.json();

  const building = body.building?.trim();
  const room = body.room?.trim() || null;
  const foodType = body.food_type?.trim();
  const quantity = body.quantity;
  const notes = body.notes?.trim() || null;

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