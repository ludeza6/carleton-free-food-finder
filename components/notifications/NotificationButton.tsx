"use client";

import { useEffect, useState } from "react";

type NotificationState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export default function NotificationButton() {
  const [permission, setPermission] =
    useState<NotificationState>("default");

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(
      Notification.permission as NotificationState,
    );
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      return;
    }

    const result =
      await Notification.requestPermission();

    setPermission(
      result as NotificationState,
    );
  }

  if (permission === "unsupported") {
    return (
      <p className="text-sm opacity-70">
        Browser notifications are not supported.
      </p>
    );
  }

  if (permission === "granted") {
    return (
      <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300">
  Notifications enabled
</p>
    );
  }

  if (permission === "denied") {
    return (
      <p className="text-sm opacity-70">
        Notifications are blocked in your browser.
      </p>
    );
  }

  return (
    <button
  type="button"
  onClick={enableNotifications}
  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
>
  Enable notifications
</button>
  );
}