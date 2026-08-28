"use client";

import { useState } from "react";

export default function ReportForm() {
  const [building, setBuilding] = useState("");
  const [room, setRoom] = useState("");
  const [foodType, setFoodType] = useState("");
  const [quantity, setQuantity] = useState("some");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setSubmitting(true);
    setMessage("");

    const response = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        building,
        room,
        food_type: foodType,
        quantity,
        notes,
      }),
    });

    if (!response.ok) {
      setMessage("Could not submit report.");
      setSubmitting(false);
      return;
    }

    setBuilding("");
    setRoom("");
    setFoodType("");
    setQuantity("some");
    setNotes("");
    setMessage("Report submitted.");
    setSubmitting(false);

    window.location.reload();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border p-4"
    >
      <h2 className="text-xl font-semibold">Report free food</h2>

      <input
        value={building}
        onChange={(e) => setBuilding(e.target.value)}
        placeholder="Building"
        required
        className="w-full rounded border bg-transparent p-2"
      />

      <input
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        placeholder="Room (optional)"
        className="w-full rounded border bg-transparent p-2"
      />

      <input
        value={foodType}
        onChange={(e) => setFoodType(e.target.value)}
        placeholder="Food type"
        required
        className="w-full rounded border bg-transparent p-2"
      />

      <select
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        className="w-full rounded border bg-transparent p-2"
      >
        <option value="lots">Lots</option>
        <option value="some">Some</option>
        <option value="almost_gone">Almost gone</option>
      </select>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded border bg-transparent p-2"
      />

      <button
        type="submit"
        disabled={submitting}
        className="rounded border px-4 py-2"
      >
        {submitting ? "Submitting..." : "Report food"}
      </button>

      {message && <p>{message}</p>}
    </form>
  );
}