"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { IconBrandApple, IconChevronDown, IconLogout } from "@tabler/icons-react";


import { signOutAction } from "@/lib/auth/signOutAction";
import type { ProfileRole } from "@/lib/auth/requireProfile";
import { DashboardIcon, PhonesIcon, ReportsIcon, UsersIcon, NotificationsIcon, SettingsIcon } from "@/components/shell/navIcons";
import { formatRole } from "@/lib/format/display";

const mobileNav = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/inventory", label: "My Phones", Icon: PhonesIcon },
  { href: "/dealers", label: "Dealers", Icon: UsersIcon },
  { href: "/notifications", label: "Alerts", Icon: NotificationsIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

const desktopNav = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/inventory", label: "My Phones", Icon: PhonesIcon },
  { href: "/dealers", label: "Dealers", Icon: UsersIcon },
  { href: "/notifications", label: "Notifications", Icon: NotificationsIcon },
  { href: "/reports", label: "Reports", Icon: ReportsIcon },
  { href: "/workers", label: "Workers", Icon: UsersIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

// Note: we keep nav simple. Access to /workers will be role-guarded on the page itself.



function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "User";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ProfileMenu({ profile }: { profile: { fullName: string | null; email: string | null; role: ProfileRole } }) {
  const label = profile.fullName || profile.email || "User";

  return (
    <details className="group relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-black/5 bg-card px-2 pr-3 text-sm font-semibold shadow-sm transition hover:bg-background [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(profile.fullName, profile.email)}
        </span>
        <span className="hidden max-w-36 truncate sm:block">{label}</span>
        <IconChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-black/5 bg-card p-3 shadow-xl">
        <div className="rounded-xl bg-background p-3">
          <div className="truncate text-sm font-semibold">{label}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{profile.email ?? "No email"}</div>
          <div className="mt-2 w-fit rounded-full bg-card px-2 py-1 text-[11px] font-semibold capitalize text-muted-foreground">
            {formatRole(profile.role)}
          </div>
        </div>
        <Link href="/settings" className="mt-2 flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:bg-background hover:text-foreground">
          Settings
        </Link>
        <form action={signOutAction} className="mt-1">
          <button className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50">
            <IconLogout className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

export function AppShell({
  children,
  notificationCount = 0,
  profile,
}: {
  children: ReactNode;
  notificationCount?: number;
  profile: { fullName: string | null; email: string | null; role: ProfileRole };
}) {

  const pathname = usePathname();
  const role = profile.role;
  const filteredDesktopNav = desktopNav.filter((item) => {
    if (role === "admin") return true;
    return item.href !== "/reports" && item.href !== "/workers";
  });

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 shrink-0 flex-col border-r border-black/5 bg-card/95 backdrop-blur md:flex">
        <div className="border-b border-black/5 px-6 py-8">
          <div className="text-xl font-semibold tracking-tight">Regan Phones</div>
          <div className="mt-2 text-sm text-muted-foreground">Phones, sales, dealers.</div>
        </div>

        <nav className="px-4 py-6">
          <div className="flex flex-col gap-2">
            {filteredDesktopNav.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const showBadge = href === "/notifications" && notificationCount > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={
                    active
                      ? "flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm"
                      : "flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-muted-foreground transition hover:bg-background hover:text-foreground"
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="min-w-0 flex-1">{showBadge ? `${label} (${notificationCount})` : label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="mt-auto border-t border-black/5 px-6 py-6">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {role === "admin" ? "Owner access" : "Worker access"}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-black/5 bg-card/95 px-4 backdrop-blur sm:px-6 xl:px-12">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <IconBrandApple className="h-5 w-5" />
            </span>
            <span className="truncate text-sm font-semibold sm:text-base">Regan Phones</span>
          </Link>
          <ProfileMenu profile={profile} />
        </header>

        <main className="flex-1 px-3 py-4 pb-24 sm:px-6 md:py-10 md:pb-10 xl:px-12">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-black/5 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="grid grid-cols-5">
            {mobileNav.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const showBadge = href === "/notifications" && notificationCount > 0;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  className={
                    active
                      ? "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-semibold text-foreground"
                      : "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-xs text-muted-foreground transition hover:text-foreground"
                  }
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {showBadge ? (
                      <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                        {notificationCount > 9 ? "9+" : notificationCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="leading-none">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Prevent content behind bottom nav */}
        <div className="h-20 md:hidden" />
      </div>
    </div>
  );
}


