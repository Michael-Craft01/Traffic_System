"use client";
import React, { useState, useEffect } from "react";
import { 
  Settings2, 
  MapPin, 
  Phone, 
  User, 
  BellRing, 
  Volume2, 
  Server,
  Brain,
  Video,
  Database,
  CheckCircle2,
  X,
  AlertTriangle
} from "lucide-react";

interface Profile {
  name: string;
  home: string;
  office: string;
  phone: string;
}

interface Prefs {
  voiceAlerts: boolean;
  congestionNotif: boolean;
  incidentNotif: boolean;
  predictiveAlerts: boolean;
  highContrast: boolean;
}

const DEFAULT_PROFILE: Profile = {
  name: "Commuter",
  home: "Sector 7",
  office: "CBD North",
  phone: "",
};

const DEFAULT_PREFS: Prefs = {
  voiceAlerts: false,
  congestionNotif: true,
  incidentNotif: true,
  predictiveAlerts: true,
  highContrast: false,
};

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${
        on ? "bg-black" : "bg-zinc-300"
      }`}
    >
      <span className="sr-only">Toggle setting</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="w-16 h-16 rounded-3xl bg-zinc-800 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-black/20 shrink-0 border border-zinc-700">
      {initials || "?"}
    </div>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [prefs,   setPrefs]   = useState<Prefs>(DEFAULT_PREFS);
  const [saved,   setSaved]   = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const p = localStorage.getItem("traffic_profile");
    const r = localStorage.getItem("traffic_prefs");
    if (p) setProfile(JSON.parse(p));
    if (r) setPrefs(JSON.parse(r));
  }, []);

  const saveProfile = () => {
    localStorage.setItem("traffic_profile", JSON.stringify(profile));
    localStorage.setItem("traffic_prefs",   JSON.stringify(prefs));
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const togglePref = (key: keyof Prefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const VERSION = "1.0.0-beta";

  return (
    <div className="h-full overflow-y-auto bg-zinc-100 pb-20 relative">
      
      {/* Background Mesh */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-300 via-zinc-100 to-zinc-50" />
      
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl px-5 pt-8 pb-4 border-b border-white/60 shadow-sm shadow-black/5 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
            <Settings2 className="text-black" size={24} strokeWidth={3} />
            Settings
          </h1>
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
            Profile & Preferences
          </p>
        </div>
        {saved && (
           <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg text-[10px] font-black uppercase tracking-wider animate-in fade-in zoom-in duration-300 shadow-md">
             <CheckCircle2 size={14} /> Saved
           </div>
        )}
      </div>

      <div className="p-5 space-y-6 relative z-10">

        {/* Profile Card */}
        <section className="bg-white/70 backdrop-blur-xl p-5 rounded-3xl border border-white/60 shadow-lg shadow-black/5 flex items-center gap-5 relative transition-all">
           <Avatar name={profile.name} />
           <div className="flex-1 min-w-0">
              <p className="font-black text-xl text-black truncate leading-tight">{profile.name}</p>
              <div className="flex items-center gap-2 mt-1.5">
                 <MapPin size={14} className="text-zinc-400 shrink-0" />
                 <p className="text-[11px] font-bold text-zinc-500 truncate uppercase tracking-wide">
                   {profile.home} <span className="text-zinc-300 mx-1">→</span> {profile.office}
                 </p>
              </div>
           </div>
           <button 
             onClick={() => setEditing(!editing)}
             className="absolute top-5 right-5 text-[10px] font-black text-black bg-white border border-black/10 px-3 py-2 rounded-xl uppercase tracking-widest hover:bg-zinc-50 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-1.5"
           >
             {editing ? <><X size={14} className="text-zinc-400" /> Close</> : "Edit"}
           </button>
        </section>

        {/* Edit Form */}
        {editing && (
          <section className="bg-white/80 backdrop-blur-2xl p-6 rounded-3xl border border-white/60 shadow-xl shadow-black/10 animate-in fade-in slide-in-from-top-4 duration-300">
             <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-5">Edit Profile</h3>
             <div className="space-y-4">
                {[
                  { label: "Display Name", key: "name",   icon: User,   placeholder: "Your name",       type: "text" },
                  { label: "Home Area",    key: "home",   icon: MapPin, placeholder: "e.g. Sector 7",   type: "text" },
                  { label: "Office Area",  key: "office", icon: MapPin, placeholder: "e.g. CBD North",  type: "text" },
                  { label: "Phone (optional)", key: "phone", icon: Phone, placeholder: "+263 7xx xxx xxxx", type: "tel" },
                ].map(({ label, key, icon: Icon, placeholder, type }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1.5 pl-1 uppercase tracking-wider">{label}</label>
                    <div className="relative">
                      <Icon className="absolute left-4 top-4 text-zinc-400" size={16} />
                      <input
                        type={type}
                        value={(profile as any)[key]}
                        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                        placeholder={placeholder}
                        className="w-full bg-white border border-black/10 shadow-inner rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-black placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                ))}
             </div>
             <button
               onClick={saveProfile}
               className="w-full mt-6 bg-black hover:bg-zinc-800 active:scale-95 text-white font-bold py-4 rounded-2xl shadow-xl shadow-black/20 transition-all text-sm uppercase tracking-widest"
             >
               Save Changes
             </button>
          </section>
        )}

        {/* Notifications */}
        <section>
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 pl-1 flex items-center gap-1.5">
             <BellRing size={12} className="text-zinc-500" /> Notifications
          </h3>
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-lg shadow-black/5 overflow-hidden divide-y divide-black/5">
             {[
                { key: "congestionNotif",  label: "Congestion Alerts",    desc: "Get notified when traffic spikes", icon: AlertTriangle },
                { key: "incidentNotif",    label: "Incident Reports",     desc: "New user-reported incidents nearby", icon: MapPin },
                { key: "predictiveAlerts", label: "Predictive Warnings",  desc: "AI warnings before traffic builds", icon: Brain },
                { key: "voiceAlerts",      label: "Voice Announcements",  desc: "Spoken status updates while driving", icon: Volume2 },
             ].map(({ key, label, desc, icon: Icon }) => (
               <div key={key} className="flex items-center justify-between p-5 hover:bg-white transition-colors cursor-pointer" onClick={() => { togglePref(key as keyof Prefs); saveProfile(); }}>
                 <div className="flex gap-4">
                   <div className="p-3 bg-zinc-100 text-black rounded-xl shrink-0 border border-black/5">
                     <Icon size={18} strokeWidth={2} />
                   </div>
                   <div className="pt-0.5">
                     <p className="text-sm font-bold text-black">{label}</p>
                     <p className="text-[11px] font-semibold text-zinc-500 mt-0.5">{desc}</p>
                   </div>
                 </div>
                 <Toggle on={prefs[key as keyof Prefs]} onToggle={() => {}} />
               </div>
             ))}
          </div>
        </section>

        {/* System Status */}
        <section>
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 pl-1 flex items-center gap-1.5">
             <Server size={12} className="text-zinc-500" /> System Status
          </h3>
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/60 shadow-lg shadow-black/5 overflow-hidden divide-y divide-black/5">
             {[
               { label: "Backend API",     value: "localhost:8000",   Icon: Server },
               { label: "ML Brain",        value: "PyTorch LSTM",     Icon: Brain },
               { label: "Camera Engine",   value: "YOLOv8 Nano",      Icon: Video },
               { label: "Map Provider",    value: "CARTO Voyager",    Icon: Database },
             ].map(({ label, value, Icon }) => (
               <div key={label} className="flex items-center justify-between p-5 hover:bg-white transition-colors">
                 <div className="flex items-center gap-3">
                   <Icon size={18} className="text-zinc-400" strokeWidth={2} />
                   <p className="text-sm font-bold text-black">{label}</p>
                 </div>
                 <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 border border-black/5 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                   {label === "Backend API" && <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />}
                   {value}
                 </span>
               </div>
             ))}
          </div>
        </section>

        <p className="text-center text-[10px] font-black text-zinc-400 uppercase mt-8 mb-4">
          Traffic Brain v{VERSION} <br/> <span className="opacity-70 font-bold tracking-widest">Smart City AI Platform</span>
        </p>
      </div>
    </div>
  );
}
