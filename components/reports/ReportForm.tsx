"use client";

import { useState } from "react";

const inputClasses =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-red-500";

export default function ReportForm() {
  const [
    building,
    setBuilding,
  ] = useState("");

  const [room, setRoom] =
    useState("");

  const [
    foodType,
    setFoodType,
  ] = useState("");

  const [
    quantity,
    setQuantity,
  ] = useState("some");

  const [notes, setNotes] =
    useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setSubmitting(true);
    setMessage("");

    const response = await fetch(
      "/api/reports",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          building,
          room,
          food_type:
            foodType,
          quantity,
          notes,
        }),
      },
    );

    if (!response.ok) {
      setMessage(
        "Could not submit report.",
      );

      setSubmitting(false);
      return;
    }

    setBuilding("");
    setRoom("");
    setFoodType("");
    setQuantity("some");
    setNotes("");

    setMessage(
      "Report submitted.",
    );

    setSubmitting(false);

    window.location.reload();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 lg:sticky lg:top-6"
    >
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-zinc-100">
          Spot free food?
        </h3>

        <p className="mt-1 text-sm leading-5 text-zinc-500">
          Share it with other
          Carleton students.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">
            Building
          </span>

          <input
            value={building}
            onChange={(e) =>
              setBuilding(
                e.target.value,
              )
            }
            placeholder="e.g. Nicol Building"
            required
            className={
              inputClasses
            }
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">
            Room
          </span>

          <input
            value={room}
            onChange={(e) =>
              setRoom(
                e.target.value,
              )
            }
            placeholder="Optional"
            className={
              inputClasses
            }
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">
            Food
          </span>

          <input
            value={foodType}
            onChange={(e) =>
              setFoodType(
                e.target.value,
              )
            }
            placeholder="e.g. Pizza"
            required
            className={
              inputClasses
            }
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">
            How much is left?
          </span>

          <select
            value={quantity}
            onChange={(e) =>
              setQuantity(
                e.target.value,
              )
            }
            className={
              inputClasses
            }
          >
            <option value="lots">
              Lots available
            </option>

            <option value="some">
              Some available
            </option>

            <option value="almost_gone">
              Almost gone
            </option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">
            Notes
          </span>

          <textarea
            value={notes}
            onChange={(e) =>
              setNotes(
                e.target.value,
              )
            }
            placeholder="Anything helpful: where it is, what kind of food, how many boxes..."
            rows={4}
            className={
              inputClasses
            }
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Submitting..."
          : "Report free food"}
      </button>

      {message && (
        <p className="mt-3 text-sm text-zinc-400">
          {message}
        </p>
      )}

      <p className="mt-4 text-xs leading-5 text-zinc-600">
        Reports expire automatically
        so the feed stays current.
      </p>
    </form>
  );
}