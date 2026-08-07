import { Expo, type ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export async function sendExpoPush(
  tokens: Array<string | null | undefined>,
  notification: { title: string; body: string; data?: Record<string, unknown> }
) {
  const validTokens = tokens.filter((t): t is string => !!t && Expo.isExpoPushToken(t));
  if (validTokens.length === 0) return;

  const messages: ExpoPushMessage[] = validTokens.map((to) => ({
    to,
    sound: "default",
    title: notification.title,
    body: notification.body,
    data: notification.data
  }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      // Push delivery is best-effort — the in-app Notification row is already
      // persisted regardless, so a transient Expo API failure must never fail
      // the caller's request.
      console.error("[push] failed to send chunk", err);
    }
  }
}
