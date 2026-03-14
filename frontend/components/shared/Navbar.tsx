"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, UserCircle2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearAuthUser, getAuthUser, subscribeAuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const authUser = useSyncExternalStore(subscribeAuthUser, getAuthUser, () => null);
  const navItems = [
    { href: "/", label: "标签生成", active: pathname === "/" },
    { href: "/batch", label: "批量打码", active: pathname === "/batch" },
    { href: "/history", label: "历史台账", active: pathname.startsWith("/history") },
    {
      href: "/templates",
      label: "标签模板",
      active: pathname.startsWith("/templates") || pathname.startsWith("/editor"),
    },
  ];

  const handleLogout = () => {
    clearAuthUser();
    router.replace("/login");
  };

  return (
    <header className="border-b">
      <div className="grid h-14 w-full grid-cols-[minmax(max-content,1fr)_minmax(0,72rem)_minmax(max-content,1fr)] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center justify-start">
          <Link href="/" className="flex items-center gap-2 font-semibold whitespace-nowrap">
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
              GS1
            </span>
            <span className="hidden sm:inline">UDI System</span>
          </Link>
        </div>

        <div className="hidden min-w-0 px-6 xl:block">
          <div className="w-full">
            <nav className="flex items-center justify-end gap-1 text-sm font-medium">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 transition-colors",
                    item.active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 xl:gap-3">
          <div className="xl:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="打开导航菜单"
                className={buttonVariants({ variant: "outline", size: "icon" })}
              >
                  <Menu className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>页面导航</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {navItems.map((item) => (
                  <DropdownMenuItem
                    key={item.href}
                    className={cn(item.active && "bg-muted text-foreground")}
                    onClick={() => router.push(item.href)}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {authUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "max-w-[44vw] gap-2 sm:max-w-xs xl:max-w-none",
                })}
              >
                  <UserCircle2 className="size-4 text-muted-foreground" />
                  <span className="hidden text-muted-foreground sm:inline">当前用户：</span>
                  <span className="truncate">{authUser.username}</span>
                  <ChevronDown className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <UserCircle2 className="size-4 text-muted-foreground" />
                  <div className="flex flex-col text-left">
                    <span>{authUser.username}</span>
                    <span className="text-xs font-normal text-muted-foreground">已登录用户</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive" onClick={handleLogout}>
                  <LogOut className="size-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}

