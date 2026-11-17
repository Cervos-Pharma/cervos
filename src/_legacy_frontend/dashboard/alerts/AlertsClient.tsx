"use client";

import Link from "next/link";
import type { PharmacyAlert, PharmacyNotification } from "@/lib/actions/pharmacy";
import { useI18n } from "@/lib/i18n/context";

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
  critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "error", label: "Critical" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "warning", label: "Warning" },
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "info", label: "Info" },
  urgent: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "error", label: "Urgent" },
  promo: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", icon: "campaign", label: "Promo" },
};

const HQ_KIND_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  urgent: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "error" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "warning" },
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "info" },
  promo: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", icon: "campaign" },
};

const CATEGORY_ICONS: Record<string, string> = {
  expiry: "schedule",
  stock: "inventory_2",
  sync: "sync",
  subscription: "subscriptions",
  branch: "store",
};

interface AlertsClientProps {
  alerts: PharmacyAlert[];
  notifications: PharmacyNotification[];
  error: string | null;
}

export default function AlertsClient({ alerts, notifications, error }: AlertsClientProps) {
  const { t } = useI18n();
  if (error) {
    return (
      <div className="bg-error-container text-on-error-container p-6 rounded-xl">
        <p className="font-body-md">Failed to load alerts: {error}</p>
      </div>
    );
  }

  const hasNotifications = notifications.length > 0;
  const hasAlerts = alerts.length > 0;

  if (!hasNotifications && !hasAlerts) {
    return (
      <div className="bg-surface border border-outline-variant rounded-xl p-16 text-center">
        <span className="material-symbols-outlined text-6xl text-secondary mb-4">verified</span>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-2">{t("dash.all_clear")}</h2>
        <p className="font-body-md text-on-surface-variant">
          No active alerts. Your branches are running smoothly.
        </p>
      </div>
    );
  }

  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");
  const infos = alerts.filter((a) => a.severity === "info");

  return (
    <div className="space-y-8">
      {hasNotifications && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary">campaign</span>
            <h2 className="font-label-lg text-label-lg text-primary uppercase tracking-wider">
              HQ Announcements — {notifications.length}
            </h2>
          </div>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))}
          </div>
        </section>
      )}

      {critical.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-red-500">error</span>
            <h2 className="font-label-lg text-label-lg text-red-600 uppercase tracking-wider">
              Critical — {critical.length} alert{critical.length > 1 ? "s" : ""}
            </h2>
          </div>
          <div className="space-y-3">
            {critical.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {warnings.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-amber-500">warning</span>
            <h2 className="font-label-lg text-label-lg text-amber-600 uppercase tracking-wider">
              Warnings — {warnings.length}
            </h2>
          </div>
          <div className="space-y-3">
            {warnings.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}

      {infos.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-blue-500">info</span>
            <h2 className="font-label-lg text-label-lg text-blue-600 uppercase tracking-wider">
              Informational — {infos.length}
            </h2>
          </div>
          <div className="space-y-3">
            {infos.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AlertCard({ alert }: { alert: PharmacyAlert }) {
  const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;

  return (
    <Link
      href={alert.route}
      className={`flex items-center gap-4 p-5 rounded-xl border ${style.bg} ${style.border} hover:opacity-80 transition-opacity block`}
    >
      <span className={`material-symbols-outlined text-2xl ${style.text}`}>
        {CATEGORY_ICONS[alert.category] ?? "info"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className={`font-label-md text-label-md font-semibold ${style.text}`}>{alert.title}</span>
          {alert.count > 1 && (
            <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${style.bg} ${style.text} border-current`}>
              {alert.count}
            </span>
          )}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{alert.description}</p>
      </div>
      <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
    </Link>
  );
}

function NotificationCard({ notification }: { notification: PharmacyNotification }) {
  const style = HQ_KIND_STYLES[notification.kind] ?? HQ_KIND_STYLES.info;

  return (
    <div className={`flex items-start gap-4 p-5 rounded-xl border ${style.bg} ${style.border}`}>
      <span className={`material-symbols-outlined text-2xl ${style.text}`}>
        {style.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className={`font-label-md text-label-md font-semibold capitalize ${style.text}`}>
            {notification.kind}
          </span>
          {!notification.read && (
            <span className="w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        <h3 className="font-headline-md text-headline-md mb-1">{notification.title}</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant whitespace-pre-wrap">{notification.body}</p>
        <p className="font-mono text-xs text-on-surface-variant/60 mt-2">
          {new Date(notification.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
