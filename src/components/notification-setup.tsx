"use client";

import { useEffect, useState, useTransition } from "react";
import { savePushSubscriptionAction, scheduleTestAction } from "@/app/notifications/actions";

type DeviceState = "checking" | "unsupported" | "iphone-browser" | "blocked" | "off" | "on";

function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> {
  const padded = (text + "=".repeat((4 - (text.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const isIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

async function currentState(): Promise<DeviceState> {
  if (isIphone() && !isInstalled()) return "iphone-browser";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

// Spec 3.6 and P25: turn notifications on for this device, or say plainly why it can't.
export function NotificationSetup({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<DeviceState>("checking");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    currentState().then(setState, () => setState("unsupported"));
  }, []);

  function turnOn() {
    setProblem("");
    startTransition(async () => {
      try {
        if (!publicKey) throw new Error("no key");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "blocked" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
        const json = subscription.toJSON();
        const result = await savePushSubscriptionAction({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
        if (!result.ok) setProblem(result.message);
        else setState("on");
      } catch {
        setProblem("Couldn't turn on notifications on this device. Try again.");
      }
    });
  }

  function sendTest() {
    setProblem("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await scheduleTestAction();
        if (result.ok) setMessage("Test scheduled. It should arrive about a minute from now, even if you close HQ.");
        else setProblem(result.message);
      } catch {
        setProblem("Not scheduled: HQ couldn't be reached. Try again when you're back online.");
      }
    });
  }

  return (
    <section className="notify" aria-labelledby="this-device">
      <h2 id="this-device">This device</h2>
      {state === "checking" && <p className="muted">Checking this device…</p>}
      {state === "iphone-browser" && (
        <div className="steps-box">
          <p>On iPhone, notifications only work once HQ is on your Home Screen:</p>
          <ol>
            <li>Tap the Share button in Safari.</li>
            <li>Choose “Add to Home Screen”, then Add.</li>
            <li>Open HQ from the Home Screen and come back to this page.</li>
          </ol>
        </div>
      )}
      {state === "unsupported" && <p>This browser can&apos;t show notifications from HQ. Reminders still show in Today.</p>}
      {state === "blocked" && <p>Notifications are blocked for HQ in this browser&apos;s settings. Allow them there, then reload this page.</p>}
      {state === "off" && (
        <p>
          <button type="button" className="btn btn-primary btn-small" onClick={turnOn} disabled={pending || !publicKey}>
            Turn on notifications on this device
          </button>
        </p>
      )}
      {state === "on" && <p>Notifications are on for this device.</p>}
      <p>
        <button type="button" className="btn btn-small" onClick={sendTest} disabled={pending}>
          Send a test notification in 1 minute
        </button>
      </p>
      <p role="status" className="muted">
        {message}
      </p>
      {problem && (
        <p role="alert" className="alert">
          {problem}
        </p>
      )}
    </section>
  );
}
