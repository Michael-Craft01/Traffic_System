"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart2,
  Map as RouteIcon,
  AlertCircle,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/",          label: "Live",      Icon: LayoutDashboard },
  { href: "/history",   label: "Analytics", Icon: BarChart2       },
  { href: "/commute",   label: "Commute",   Icon: RouteIcon       },
  { href: "/incidents", label: "Report",    Icon: AlertCircle     },
  { href: "/settings",  label: "Profile",   Icon: Settings        },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center bg-white/70 backdrop-blur-2xl border-t border-white/60 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] relative z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", height: 68 }}>
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            prefix="false"
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200 hover:bg-black/[0.02] active:scale-95"
          >
            <div className={`flex items-center justify-center w-12 h-8 rounded-xl transition-all duration-300 ${
              active 
                ? "bg-black text-white shadow-md shadow-black/10" 
                : "text-zinc-400 hover:text-zinc-700"
            }`}>
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            </div>
            <span className={`text-[10px] font-bold tracking-wide uppercase transition-colors duration-300 ${
              active ? "text-black" : "text-zinc-400"
            }`}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
