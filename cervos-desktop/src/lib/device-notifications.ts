/**
 * Deliver an alert outside the app window when the POS is running as a Tauri
 * desktop app.  The in-app notification is always saved first; an OS toast is
 * an additional delivery channel and must never make a stock alert fail.
 */
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

export async function notifyDevice(title: string, body: string): Promise<void> {
  try {
    let granted = await isPermissionGranted()
    if (!granted) granted = (await requestPermission()) === 'granted'
    if (granted) sendNotification({ title, body })
    return
  } catch {
    // The browser/dev build has no Tauri bridge. Do not request browser
    // permission from a background job; use it only when already granted.
  }

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body })
  }
}
