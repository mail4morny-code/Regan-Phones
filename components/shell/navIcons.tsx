import { IconBell, IconDeviceAnalytics, IconPhone, IconChartBar, IconUser, IconLayoutDashboard, IconSettings } from "@tabler/icons-react";


export function DashboardIcon({ className }: { className?: string }) {
  return <IconLayoutDashboard className={className} />;
}

export function PhonesIcon({ className }: { className?: string }) {
  return <IconPhone className={className} />;
}

export function ReportsIcon({ className }: { className?: string }) {
  return <IconChartBar className={className} />;
}

export function UsersIcon({ className }: { className?: string }) {
  return <IconUser className={className} />;
}

export function ActivityIcon({ className }: { className?: string }) {
  return <IconDeviceAnalytics className={className} />;
}

export function NotificationsIcon({ className }: { className?: string }) {
  return <IconBell className={className} />;
}

export function SettingsIcon({ className }: { className?: string }) {
  return <IconSettings className={className} />;
}

