// Push notification utilities

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    console.log("Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("Service Worker registered");
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.log("Notifications not supported");
    return "denied";
  }

  const permission = await Notification.requestPermission();
  return permission;
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    // VAPID public key - in production, set NEXT_PUBLIC_VAPID_PUBLIC_KEY env var
    const vapidPublicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    // Extract keys from subscription
    const subscriptionJson = subscription.toJSON();
    const p256dh = subscriptionJson.keys?.p256dh;
    const auth = subscriptionJson.keys?.auth;

    if (!p256dh || !auth) {
      console.error("Missing subscription keys");
      return null;
    }

    // Save subscription to Supabase via API
    const response = await fetch("/api/push-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      }),
    });

    if (!response.ok) {
      console.error("Failed to save subscription to server");
      // Still return subscription - browser will work, just no server push
    }

    return subscription;
  } catch (error) {
    console.error("Push subscription failed:", error);
    return null;
  }
}

export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      // Delete from Supabase
      await fetch("/api/push-subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      // Unsubscribe from browser
      await subscription.unsubscribe();
      return true;
    }
    return false;
  } catch (error) {
    console.error("Push unsubscribe failed:", error);
    return false;
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch (error) {
    console.error("Failed to get subscription:", error);
    return null;
  }
}

// Show a local notification (for testing or immediate notifications)
export async function showLocalNotification(
  title: string,
  body: string,
  url?: string
): Promise<void> {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    data: { url: url || "/" },
    tag: "local-notification",
  } as NotificationOptions);
}

// Schedule a local notification after a delay (for 30-min reminders)
export function scheduleNotification(
  title: string,
  body: string,
  delayMs: number,
  url?: string
): number {
  const timeoutId = window.setTimeout(() => {
    showLocalNotification(title, body, url);
  }, delayMs);

  return timeoutId;
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if notifications are supported and enabled
export function checkNotificationSupport(): {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
} {
  if (!("Notification" in window)) {
    return { supported: false, permission: "unsupported" };
  }

  return { supported: true, permission: Notification.permission };
}
