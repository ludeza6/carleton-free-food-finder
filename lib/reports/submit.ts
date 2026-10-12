import "server-only";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";

export interface ReportDependencies {
  salt: () => string | undefined;
  insert: (ipHash: string, report: Record<string, unknown>) => PromiseLike<{
    data: unknown; error: { code?: string } | null;
  }>;
}

export function hashClientIp(headers: Headers, salt: string | undefined): string {
  if (!salt?.trim()) throw new Error("Missing rate limit salt");
  // Only trust these headers behind a proxy that overwrites client-supplied values.
  const forwarded = headers.get("x-forwarded-for");
  let ip = (forwarded !== null ? forwarded.split(",")[0] : headers.get("x-real-ip"))?.trim();
  if (!ip || !isIP(ip)) throw new Error("Missing or invalid client IP");
  if (isIP(ip) === 6) {
    ip = new URL(`http://[${ip}]/`).hostname.slice(1, -1).toLowerCase();
    // Normalize IPv4-mapped IPv6 to the equivalent IPv4 address.
    const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(ip);
    if (mapped) {
      const bytes = [parseInt(mapped[1], 16), parseInt(mapped[2], 16)];
      ip = bytes.flatMap((part) => [part >> 8, part & 255]).join(".");
    }
  }
  return createHash("sha256").update(salt).update("\0").update(ip).digest("hex");
}

const VALID_QUANTITIES = ["lots", "some", "almost_gone"];

export async function submitReport(request: Request, dependencies: ReportDependencies) {
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
  if (input.website != null && input.website !== "") {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }
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
    if (value.trim() && !/[\p{L}\p{N}]/u.test(value)) {
      return NextResponse.json({ error: `${field} must contain letters or numbers` }, { status: 400 });
    }
    if (value.length > 0 && !value.trim()) {
      return NextResponse.json({ error: `${field} cannot contain only whitespace` }, { status: 400 });
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

  if (Array.from(foodType).filter((character) => /[\p{L}\p{N}]/u.test(character)).length < 2) {
    return NextResponse.json({ error: "Food type must contain at least two letters or numbers" }, { status: 400 });
  }

  if (!VALID_QUANTITIES.includes(quantity)) {
    return NextResponse.json(
      { error: "Invalid quantity" },
      { status: 400 },
    );
  }

  let ipHash: string;
  try {
    ipHash = hashClientIp(request.headers, dependencies.salt());
  } catch {
    return NextResponse.json({ error: "Reporting is temporarily unavailable" }, { status: 503 });
  }

  const expiresAt = new Date(
    Date.now() + 2 * 60 * 60 * 1000,
  ).toISOString();

  let result: Awaited<ReturnType<ReportDependencies["insert"]>>;
  try {
    result = await dependencies.insert(ipHash, {
      building, room, food_type: foodType, quantity, notes,
      status: "active", expires_at: expiresAt,
    });
  } catch {
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
  const { data, error } = result;
  if (error?.code === "P0429") {
    return NextResponse.json(
      { error: "Report limit reached: maximum 3 reports per 15 minutes and 10 per 24 hours. Please try again later." },
      { status: 429 },
    );
  }

  if (error) {
    return NextResponse.json(
      { error: "Failed to submit report" },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
