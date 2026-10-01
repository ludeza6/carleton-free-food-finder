import "server-only";
import { Resend } from "resend";

export type AlertEvent = {
  id: string | number;
  title: string;
  food_type: string | null;
  building: string | null;
  room: string | null;
  start_time: string;
  end_time: string | null;
  source_name: string | null;
  source_url: string;
  notified_at: string | null;
};

export function isAlertEligible(event: AlertEvent, now = Date.now()) {
  return event.notified_at === null && Date.parse(event.start_time) > now &&
    (event.end_time === null || Date.parse(event.end_time) > now);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function formatEventEmail(event: AlertEvent) {
  const url = new URL(event.source_url);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Event source URL must use HTTP or HTTPS");
  }
  const start = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", dateStyle: "full", timeStyle: "short",
  }).format(new Date(event.start_time));
  const details = [
    ["Food", event.food_type || "Free food"],
    ["Location", [event.building, event.room].filter(Boolean).join(", ") || "Location TBD"],
    ["Starts", `${start} (America/Toronto)`],
    ["Source", event.source_name || "Carleton events"],
  ];
  return {
    subject: `CF3: ${event.title.replace(/[\r\n]/g, " ")}`,
    text: `New free-food event\n\n${event.title}\n\n${details.map(([label, value]) => `${label}: ${value}`).join("\n")}\nSource URL: ${url.href}\n`,
    html: `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:600px;margin:32px auto;padding:0 20px"><p style="color:#576174">CF3 · Carleton Free Food Finder</p><h1 style="font-size:24px">${escapeHtml(event.title)}</h1><p>A new free-food event was discovered.</p><dl>${details.map(([label, value]) => `<dt style="font-weight:bold">${label}</dt><dd style="margin:0 0 16px">${escapeHtml(value)}</dd>`).join("")}</dl><p><a href="${escapeHtml(url.href)}">View event at ${escapeHtml(event.source_name || "the source")}</a></p><p style="font-size:12px;color:#576174">Source URL: ${escapeHtml(url.href)}</p></body></html>`,
  };
}

export function createEventEmailSender() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.CF3_ALERT_EMAIL?.trim();
  const from = process.env.CF3_FROM_EMAIL?.trim();
  if (!apiKey || !to || !from) {
    console.info("[email-alerts] Disabled: configure RESEND_API_KEY, CF3_ALERT_EMAIL and CF3_FROM_EMAIL");
    return null;
  }
  const resend = new Resend(apiKey);
  return async (event: AlertEvent) => {
    const { data, error } = await resend.emails.send(
      { from, to: [to], ...formatEventEmail(event) },
      { idempotencyKey: `cf3-food-event/${event.id}` },
    );
    if (error || !data?.id) {
      throw new Error(`Resend send failed (${error?.name ?? "missing_email_id"})`);
    }
  };
}
