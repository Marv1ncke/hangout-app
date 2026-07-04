"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useGroup } from "@/components/state/useGroup";

type Slot = {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type FilterMode = "today" | "tomorrow" | "week";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function intersects(slotStart: Date, slotEnd: Date, rangeStart: Date, rangeEnd: Date) {
  return slotStart < rangeEnd && slotEnd > rangeStart;
}

export default function AvailabilityPage() {
  const { groupId, groupName } = useGroup();

  const [slots, setSlots] = useState<Slot[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<FilterMode>("today");
  const [start, setStart] = useState(toInputValue(new Date()));
  const [end, setEnd] = useState(
    toInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000))
  );
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!groupId) {
      setSlots([]);
      setProfiles([]);
      return;
    }

    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    const userIds = (members || []).map((m) => m.user_id);

    if (userIds.length) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      setProfiles(profileRows || []);
    } else {
      setProfiles([]);
    }

    const { data: slotRows } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("group_id", groupId)
      .order("starts_at", { ascending: true });

    setSlots(slotRows || []);
  }

  useEffect(() => {
    load();
  }, [groupId]);

  async function addBusySlot() {
    if (!groupId) return alert("Select a group first.");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return alert("Not logged in.");

    setSaving(true);

    const { error } = await supabase.from("availability_slots").insert({
      group_id: groupId,
      user_id: user.id,
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(end).toISOString(),
      status: "busy",
    });

    setSaving(false);

    if (error) return alert(error.message);
    await load();
  }

  async function deleteSlot(id: string) {
    const { error } = await supabase
      .from("availability_slots")
      .delete()
      .eq("id", id);

    if (error) return alert(error.message);
    await load();
  }

  const range = useMemo(() => {
    const now = new Date();

    if (filter === "today") {
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    }

    if (filter === "tomorrow") {
      const tomorrow = addDays(now, 1);
      return {
        start: startOfDay(tomorrow),
        end: endOfDay(tomorrow),
      };
    }

    return {
      start: startOfDay(now),
      end: endOfDay(addDays(now, 6)),
    };
  }, [filter]);

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) =>
      intersects(
        new Date(slot.starts_at),
        new Date(slot.ends_at),
        range.start,
        range.end
      )
    );
  }, [slots, range]);

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  const slotsByUser = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of filteredSlots) {
      if (!map.has(slot.user_id)) map.set(slot.user_id, []);
      map.get(slot.user_id)!.push(slot);
    }
    return map;
  }, [filteredSlots]);

  const availabilitySummary = useMemo(() => {
    const members = profiles.map((p) => p.id);
    if (!members.length) {
      return { fullFree: [], almostFree: [] as { start: Date; end: Date; busyCount: number }[] };
    }

    const windows: { start: Date; end: Date; busyUsers: Set<string> }[] = [];
    const stepMs = 60 * 60 * 1000; // 1 hour

    for (let t = range.start.getTime(); t < range.end.getTime(); t += stepMs) {
      const windowStart = new Date(t);
      const windowEnd = new Date(t + stepMs);

      const busyUsers = new Set<string>();

      for (const slot of filteredSlots) {
        const s = new Date(slot.starts_at);
        const e = new Date(slot.ends_at);
        if (intersects(s, e, windowStart, windowEnd)) {
          busyUsers.add(slot.user_id);
        }
      }

      windows.push({ start: windowStart, end: windowEnd, busyUsers });
    }

    const fullFree = windows.filter((w) => w.busyUsers.size === 0);
    const almostFree = windows
      .filter((w) => w.busyUsers.size > 0 && w.busyUsers.size <= 2)
      .map((w) => ({
        start: w.start,
        end: w.end,
        busyCount: w.busyUsers.size,
      }));

    return { fullFree, almostFree };
  }, [filteredSlots, profiles, range]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Availability</h1>
        <p className="text-sm text-neutral-500">
          {groupName
            ? `See who’s busy, when everyone is free, and where the easiest overlap is for ${groupName}.`
            : "Select a group first."}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white p-5 space-y-4">
            <div>
              <h2 className="font-semibold">Mark yourself busy</h2>
              <p className="text-sm text-neutral-500">
                Add the times you’re not available.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border p-3"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End</label>
              <input
                type="datetime-local"
                className="w-full rounded-xl border p-3"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>

            <button
              onClick={addBusySlot}
              disabled={saving}
              className="rounded-xl bg-black text-white px-4 py-2"
            >
              {saving ? "Saving..." : "Add busy block"}
            </button>
          </div>

          <div className="rounded-2xl border bg-white p-5 space-y-4">
            <div>
              <h2 className="font-semibold">Time filter</h2>
            </div>

            <div className="flex gap-2 flex-wrap">
              {(["today", "tomorrow", "week"] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilter(mode)}
                  className={`rounded-xl px-3 py-2 text-sm border ${
                    filter === mode ? "bg-black text-white border-black" : ""
                  }`}
                >
                  {mode === "today"
                    ? "Today"
                    : mode === "tomorrow"
                    ? "Tomorrow"
                    : "This week"}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 space-y-4">
            <div>
              <h2 className="font-semibold">Best time for everyone</h2>
              <p className="text-sm text-neutral-500">
                Fully free = nobody has a busy block in that hour.
              </p>
            </div>

            <div className="space-y-2">
              {availabilitySummary.fullFree.length === 0 ? (
                <div className="text-sm text-neutral-500">
                  No full free slots in this filter.
                </div>
              ) : (
                availabilitySummary.fullFree.slice(0, 8).map((slot, i) => (
                  <div key={i} className="rounded-xl border p-3 text-sm">
                    <div className="font-medium">Everyone free</div>
                    <div className="text-neutral-500">
                      {slot.start.toLocaleString()} → {slot.end.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 space-y-4">
            <div>
              <h2 className="font-semibold">Almost works</h2>
              <p className="text-sm text-neutral-500">
                Slots blocked by only 1–2 people.
              </p>
            </div>

            <div className="space-y-2">
              {availabilitySummary.almostFree.length === 0 ? (
                <div className="text-sm text-neutral-500">
                  No near-match slots.
                </div>
              ) : (
                availabilitySummary.almostFree.slice(0, 8).map((slot, i) => (
                  <div key={i} className="rounded-xl border p-3 text-sm">
                    <div className="font-medium">
                      {slot.busyCount} friend{slot.busyCount > 1 ? "s" : ""} blocking
                    </div>
                    <div className="text-neutral-500">
                      {slot.start.toLocaleString()} → {slot.end.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="mb-4">
            <h2 className="font-semibold">Per person</h2>
            <p className="text-sm text-neutral-500">
              See who is busy in the selected period.
            </p>
          </div>

          <div className="space-y-4">
            {profiles.length === 0 ? (
              <div className="text-sm text-neutral-500">No members found.</div>
            ) : (
              profiles.map((profile) => {
                const personSlots = slotsByUser.get(profile.id) || [];

                return (
                  <div key={profile.id} className="rounded-2xl border p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={profile.avatar_url || "https://placehold.co/80x80/png"}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover border"
                      />
                      <div>
                        <div className="font-medium">
                          {profile.full_name || "Unnamed friend"}
                        </div>
                        <div className="text-sm text-neutral-500">
                          {personSlots.length === 0
                            ? "No busy blocks in this period"
                            : `${personSlots.length} busy block${
                                personSlots.length > 1 ? "s" : ""
                              }`}
                        </div>
                      </div>
                    </div>

                    {personSlots.length === 0 ? (
                      <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl p-3">
                        Free in this filtered period.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {personSlots.map((slot) => (
                          <div
                            key={slot.id}
                            className="rounded-xl border p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                          >
                            <div className="text-sm">
                              <div className="font-medium">Busy</div>
                              <div className="text-neutral-500">
                                {new Date(slot.starts_at).toLocaleString()} →{" "}
                                {new Date(slot.ends_at).toLocaleString()}
                              </div>
                            </div>

                            <button
                              onClick={() => deleteSlot(slot.id)}
                              className="rounded-xl border px-3 py-2 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}