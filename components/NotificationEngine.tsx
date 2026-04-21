"use client";
import { useEffect, useRef, useState } from "react";
import { getSavedRoutes, setLastNotified, getLastNotified } from "@/lib/storage";
import { fetchRecommendation } from "@/lib/api";
import { ShieldCheck, ShieldAlert, BellOff, X } from "lucide-react";

const CHECK_INTERVAL_MS = 60000;
const NOTIFICATION_WINDOW_MINS = 30;
const COOLDOWN_MS = 8 * 60 * 60 * 1000;

export default function NotificationEngine() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [showStatus, setShowStatus] = useState(false);
  const [hasRoutes, setHasRoutes] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
    const checkRoutes = () => {
      const routes = getSavedRoutes();
      setHasRoutes(routes.some(r => !!r.scheduledTime));
    };
    checkRoutes();
    const iv = setInterval(checkRoutes, 10000);
    return () => clearInterval(iv);
  }, []);

  const requestPermission = async () => {
    if ("Notification" in window) {
      const res = await Notification.requestPermission();
      setPermission(res);
      if (res === "granted") setShowStatus(false);
    }
  };

  const checkTraffic = async () => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const savedRoutes = getSavedRoutes();

    for (const route of savedRoutes) {
      if (!route.scheduledTime) continue;
      const [h, m] = route.scheduledTime.split(":").map(Number);
      const scheduledMins = h * 60 + m;
      const diff = scheduledMins - currentMins;
      const isInWindow = diff > 0 && diff <= NOTIFICATION_WINDOW_MINS;

      if (isInWindow) {
        const lastSent = getLastNotified(route.id);
        if (Date.now() - lastSent < COOLDOWN_MS) continue;
        try {
          const rcm = await fetchRecommendation(route.id, 0);
          if (rcm.status === "ALERT" || rcm.status === "WARNING") {
            triggerNotification(route.label, rcm.message);
            setLastNotified(route.id);
          }
        } catch (error) {
          console.error("Proactive check failed:", error);
        }
      }
    }
  };

  const triggerNotification = (label: string, message: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`Traffic Alert: ${label}`, { body: message, icon: "/favicon.ico" });
    }
  };

  useEffect(() => {
    timerRef.current = setInterval(checkTraffic, CHECK_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (!hasRoutes && permission === "granted") return null;

  return (
    <div className="fixed top-4 right-4 z-[3000] flex flex-col items-end gap-2 pointer-events-none">
      {/* Permission Warning */}
      {permission !== "granted" && (
        <div className="bg-white rounded-2xl shadow-2xl border border-black/5 p-4 pointer-events-auto animate-in slide-in-from-right-8 duration-500 max-w-[240px]">
          <div className="flex gap-3">
             <div className="bg-amber-100 p-2 rounded-xl text-amber-600 shrink-0">
               <BellOff size={20} />
             </div>
             <div>
               <p className="text-xs font-black text-black mb-1">Alerts Disabled</p>
               <p className="text-[10px] font-bold text-zinc-500 leading-tight mb-3">Enable notifications to receive proactive commute warnings.</p>
               <button onClick={requestPermission} className="bg-black text-white text-[10px] font-black px-3 py-2 rounded-lg active:scale-95 transition-all">
                 Enable Now
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Monitoring Status Pill */}
      {permission === "granted" && hasRoutes && (
        <button 
          onClick={() => setShowStatus(!showStatus)}
          className="bg-white/90 backdrop-blur-md border border-black/5 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg pointer-events-auto active:scale-95 transition-all group"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-black text-black">Traffic Shield Active</span>
          <ShieldCheck size={14} className="text-green-600" />
        </button>
      )}

      {showStatus && permission === "granted" && (
        <div className="bg-black text-white rounded-2xl p-4 shadow-2xl pointer-events-auto animate-in zoom-in-95 duration-200 max-w-[200px]">
           <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">System Status</p>
              <button onClick={() => setShowStatus(false)}><X size={14}/></button>
           </div>
           <p className="text-xs font-bold leading-relaxed">
             AI is monitoring {getSavedRoutes().filter(r => !!r.scheduledTime).length} scheduled routes. You will receive a push notification if congestion is detected.
           </p>
        </div>
      )}
    </div>
  );
}
