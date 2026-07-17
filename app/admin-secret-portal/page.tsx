"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Users,
  LayoutGrid,
  BarChart3,
  ChevronDown,
  Lock,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

type Tab = "users" | "groups" | "charts";

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  user_agent: string | null;
  signup_country: string | null;
};

type EmailRow = { id: string; email: string; last_sign_in_at: string | null };

type GroupRow = {
  id: string;
  name: string;
  created_at: string;
  join_code: string;
};

type MembershipRow = { group_id: string; user_id: string; status: string };

function parseDevice(ua: string | null): string {
  if (!ua) return "Onbekend";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Overig";
}

export default function AdminSecretPortal() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [checking, setChecking] = useState(false);

  const [tab, setTab] = useState<Tab>("users");
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("admin_portal_token");
    if (token) setAuthed(true);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setAuthError("");
    const res = await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setChecking(false);
    if (!res.ok) {
      setAuthError("Verkeerd wachtwoord.");
      return;
    }
    localStorage.setItem("admin_portal_token", data.token);
    setAuthed(true);
  }

  useEffect(() => {
    if (!authed) return;
    async function loadAll() {
      setLoading(true);
      const [profilesRes, emailsRes, groupsRes, membershipsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, created_at, user_agent, signup_country"),
        supabase.rpc("admin_get_user_emails"),
        supabase.from("groups").select("id, name, created_at, join_code"),
        supabase.from("group_members").select("group_id, user_id, status").eq("status", "active"),
      ]);
      setProfiles((profilesRes.data as ProfileRow[]) ?? []);
      setEmails((emailsRes.data as EmailRow[]) ?? []);
      setGroups((groupsRes.data as GroupRow[]) ?? []);
      setMemberships((membershipsRes.data as MembershipRow[]) ?? []);
      setLoading(false);
    }
    loadAll();
  }, [authed]);

  const emailMap = useMemo(() => new Map(emails.map((e) => [e.id, e])), [emails]);
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const userGroupsMap = useMemo(() => {
    const map = new Map<string, GroupRow[]>();
    for (const m of memberships) {
      const g = groupMap.get(m.group_id);
      if (!g) continue;
      if (!map.has(m.user_id)) map.set(m.user_id, []);
      map.get(m.user_id)!.push(g);
    }
    return map;
  }, [memberships, groupMap]);

  const groupMembersMap = useMemo(() => {
    const map = new Map<string, ProfileRow[]>();
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    for (const m of memberships) {
      const p = profileById.get(m.user_id);
      if (!p) continue;
      if (!map.has(m.group_id)) map.set(m.group_id, []);
      map.get(m.group_id)!.push(p);
    }
    return map;
  }, [memberships, profiles]);

  const signupsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of profiles) {
      const day = new Date(p.created_at).toISOString().slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date: date.slice(5), count }));
  }, [profiles]);

  const deviceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of profiles) {
      const d = parseDevice(p.user_agent);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([device, count]) => ({ device, count }));
  }, [profiles]);

  const countryBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of profiles) {
      const c = p.signup_country ?? "Onbekend";
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([country, count]) => ({ country, count }));
  }, [profiles]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-xs rounded-2xl border border-border bg-container-bg p-6 space-y-4"
        >
          <div className="flex items-center gap-2 text-neutral-400">
            <Lock size={16} />
            <p className="text-xs font-bold uppercase tracking-wider">Admin</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Wachtwoord"
            className="w-full rounded-xl bg-background border border-border p-3 text-sm outline-none"
            autoFocus
          />
          {authError && <p className="text-xs text-red-500 font-bold">{authError}</p>}
          <button
            type="submit"
            disabled={checking}
            className="w-full rounded-xl bg-btn-bg text-btn-text py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {checking ? "Controleren..." : "Ontgrendel"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Admin dashboard</h1>
        <p className="text-xs text-neutral-400 font-bold mt-0.5">{profiles.length} gebruikers · {groups.length} groepen</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {([
          { id: "users", label: "Gebruikers", icon: Users },
          { id: "groups", label: "Groepen", icon: LayoutGrid },
          { id: "charts", label: "Grafieken", icon: BarChart3 },
        ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              tab === id ? "bg-btn-bg text-btn-text" : "text-neutral-400 hover:bg-container-bg"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Laden...</p>
      ) : tab === "users" ? (
        <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {profiles
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((p) => {
              const email = emailMap.get(p.id);
              const userGroups = userGroupsMap.get(p.id) ?? [];
              const isOpen = expandedUser === p.id;
              return (
                <div key={p.id} className="bg-container-bg">
                  <button
                    onClick={() => setExpandedUser(isOpen ? null : p.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="size-9 rounded-full bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center text-xs font-black text-foreground">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (p.full_name ?? "?").slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{p.full_name ?? "Naamloos"}</p>
                      <p className="text-[11px] text-neutral-400 font-medium">
                        {new Date(p.created_at).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <ChevronDown size={16} className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-background rounded-lg p-2.5 border border-border">
                          <p className="text-neutral-400 font-bold text-[10px] uppercase">Email</p>
                          <p className="text-foreground font-medium truncate">{email?.email ?? "-"}</p>
                        </div>
                        <div className="bg-background rounded-lg p-2.5 border border-border">
                          <p className="text-neutral-400 font-bold text-[10px] uppercase">Laatst actief</p>
                          <p className="text-foreground font-medium">
                            {email?.last_sign_in_at ? new Date(email.last_sign_in_at).toLocaleDateString("nl-BE") : "-"}
                          </p>
                        </div>
                        <div className="bg-background rounded-lg p-2.5 border border-border">
                          <p className="text-neutral-400 font-bold text-[10px] uppercase">Device</p>
                          <p className="text-foreground font-medium">{parseDevice(p.user_agent)}</p>
                        </div>
                        <div className="bg-background rounded-lg p-2.5 border border-border">
                          <p className="text-neutral-400 font-bold text-[10px] uppercase">Land</p>
                          <p className="text-foreground font-medium">{p.signup_country ?? "Onbekend"}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-neutral-400 font-bold text-[10px] uppercase mb-1">Groepen ({userGroups.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {userGroups.length === 0 && <span className="text-neutral-400">Geen</span>}
                          {userGroups.map((g) => (
                            <span key={g.id} className="bg-background border border-border rounded-lg px-2 py-1 text-foreground font-bold">
                              {g.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ) : tab === "groups" ? (
        <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {groups
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((g) => {
              const members = groupMembersMap.get(g.id) ?? [];
              return (
                <div key={g.id} className="bg-container-bg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">{g.name}</p>
                    <p className="text-[11px] text-neutral-400 font-medium">
                      {new Date(g.created_at).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <p className="text-[11px] text-neutral-400 font-bold">{members.length} leden · code {g.join_code}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => (
                      <span key={m.id} className="bg-background border border-border rounded-lg px-2 py-1 text-[11px] text-foreground font-bold">
                        {m.full_name ?? "Naamloos"}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-container-bg border border-border rounded-2xl p-5">
            <p className="text-xs font-bold text-neutral-400 uppercase mb-4">Registraties per dag</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={signupsByDay}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="currentColor" className="text-foreground" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-container-bg border border-border rounded-2xl p-5">
              <p className="text-xs font-bold text-neutral-400 uppercase mb-4">Device-verdeling</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={deviceBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="device" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="currentColor" className="text-foreground" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-container-bg border border-border rounded-2xl p-5">
              <p className="text-xs font-bold text-neutral-400 uppercase mb-4">Land-verdeling</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={countryBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="country" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="currentColor" className="text-foreground" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}