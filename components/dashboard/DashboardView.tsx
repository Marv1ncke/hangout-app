"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useGroup } from "@/components/state/useGroup";
import { useModal } from "@/components/ui/useModal";

type EventRow = {
  id: string;
  title: string;
  location_name: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
};

type VoteRow = {
  id: string;
  event_id: string;
  vote_type: "yes" | "maybe" | "no";
};

type ItemRow = {
  id: string;
  event_id: string;
  claimed_by: string | null;
  checked: boolean;
};

type SlotRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  user_id: string;
};

function intersects(slotStart: number, slotEnd: number, rangeStart: number, rangeEnd: number) {
  return slotStart < rangeEnd && slotEnd > rangeStart;
}

export function DashboardView() {
  const { groupId, groupName } = useGroup();
  const { openModal } = useModal();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  // Keep a unified point-in-time reference that refreshes whenever the active group changes
  const [renderTimestamp, setRenderTimestamp] = useState(() => Date.now());

  async function load() {
    if (!groupId) {
      setEvents([]);
      setVotes([]);
      setItems([]);
      setSlots([]);
      setMemberCount(0);
      return;
    }

    setRenderTimestamp(Date.now());

    const { data: memberRows } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    setMemberCount((memberRows || []).length);

    const { data: eventRows } = await supabase
      .from("events")
      .select("*")
      .eq("group_id", groupId)
      .order("start_time", { ascending: true });

    const eventIds = (eventRows || []).map((e) => e.id);

    setEvents((eventRows || []) as EventRow[]);

    if (eventIds.length) {
      const { data: voteRows } = await supabase
        .from("event_votes")
        .select("*")
        .in("event_id", eventIds);

      const { data: itemRows } = await supabase
        .from("event_items")
        .select("*")
        .in("event_id", eventIds);

      setVotes((voteRows || []) as VoteRow[]);
      setItems((itemRows || []) as ItemRow[]);
    } else {
      setVotes([]);
      setItems([]);
    }

    const { data: slotRows } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("group_id", groupId);

    setSlots((slotRows || []) as SlotRow[]);
  }

  useEffect(() => {
    // Gebruik een microtask of setTimeout om de render-cycle te deblokkeren
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [groupId]);

  useEffect(() => {
    function refresh() {
      load();
    }

    window.addEventListener("hangout:event-created", refresh);
    return () => window.removeEventListener("hangout:event-created", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const upcomingEvent = useMemo(() => {
    return events.find((e) => new Date(e.end_time).getTime() >= renderTimestamp) ?? null;
  }, [events, renderTimestamp]);

  const eventStats = useMemo(() => {
    if (!upcomingEvent) {
      return {
        voteCount: 0,
        unresolvedVotes: 0,
        missingItems: 0,
      };
    }

    const eventVotes = votes.filter((v) => v.event_id === upcomingEvent.id);
    const eventItems = items.filter((i) => i.event_id === upcomingEvent.id);

    return {
      voteCount: eventVotes.length,
      unresolvedVotes: Math.max(memberCount - eventVotes.length, 0),
      missingItems: eventItems.filter((i) => !i.claimed_by).length,
    };
  }, [upcomingEvent, votes, items, memberCount]);

  const bestFreeSlotToday = useMemo(() => {
    if (!memberCount) return null;

    // Calculate pure immutable numeric intervals instead of processing changing objects inside loops
    const baseDate = new Date(renderTimestamp);
    baseDate.setHours(0, 0, 0, 0);
    const rangeStartMs = baseDate.getTime();
    
    baseDate.setHours(23, 59, 59, 999);
    const rangeEndMs = baseDate.getTime();
    
    const stepMs = 60 * 60 * 1000;

    // Convert slots to immutable structures before computing matches
    const mappedSlots = slots.map((s) => ({
      start: new Date(s.starts_at).getTime(),
      end: new Date(s.ends_at).getTime(),
    }));

    for (let t = rangeStartMs; t < rangeEndMs; t += stepMs) {
      const slotStart = t;
      const slotEnd = t + stepMs;

      let busyCount = 0;
      for (let i = 0; i < mappedSlots.length; i++) {
        const slot = mappedSlots[i];
        if (intersects(slot.start, slot.end, slotStart, slotEnd)) {
          busyCount++;
        }
      }

      if (busyCount === 0) {
        return { start: new Date(slotStart), end: new Date(slotEnd) };
      }
    }

    return null;
  }, [slots, memberCount, renderTimestamp]);

  const planningIssues = useMemo(() => {
    return events
      .filter((e) => new Date(e.end_time).getTime() >= renderTimestamp)
      .map((event) => {
        const eventVotes = votes.filter((v) => v.event_id === event.id);
        const eventItems = items.filter((i) => i.event_id === event.id);

        return {
          id: event.id,
          title: event.title,
          missingLocation: !event.location_name,
          missingVotes: Math.max(memberCount - eventVotes.length, 0),
          missingItems: eventItems.filter((i) => !i.claimed_by).length,
        };
      })
      .filter((e) => e.missingLocation || e.missingVotes > 0 || e.missingItems > 0)
      .slice(0, 5);
  }, [events, votes, items, memberCount, renderTimestamp]);

  if (!groupId) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 p-4 md:p-8">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Welcome to Hangout</h1>
          <p className="text-sm text-neutral-500 mt-2">
            Open or create a workspace group using your sidebar layout interface to start tracking calendar syncs and event items together.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold">
          {groupName ? `${groupName} dashboard` : "Dashboard"}
        </h1>
        <p className="text-sm text-neutral-500">
          Shared planning overview for your group.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-neutral-500">Next hangout</div>
              {upcomingEvent ? (
                <>
                  <div className="text-xl font-bold mt-1">{upcomingEvent.title}</div>
                  <div className="text-sm text-neutral-500 mt-1">
                    {new Date(upcomingEvent.start_time).toLocaleString()} →{" "}
                    {new Date(upcomingEvent.end_time).toLocaleString()}
                  </div>
                  <div className="text-sm mt-2">
                    <span className="font-medium">Location:</span>{" "}
                    {upcomingEvent.location_name || "Not set yet"}
                  </div>
                </>
              ) : (
                <div className="text-sm text-neutral-500 mt-2">
                  No upcoming hangout yet.
                </div>
              )}
            </div>

            <button
              onClick={() => openModal()}
              className="rounded-xl bg-black text-white px-4 py-2 text-sm transition-colors hover:bg-neutral-800"
            >
              New hangout
            </button>
          </div>

          {upcomingEvent && (
            <div className="grid md:grid-cols-3 gap-3 pt-2">
              <div className="rounded-2xl bg-neutral-50 border p-4">
                <div className="text-sm text-neutral-500">Votes received</div>
                <div className="text-2xl font-bold mt-1">{eventStats.voteCount}</div>
              </div>
              <div className="rounded-2xl bg-neutral-50 border p-4">
                <div className="text-sm text-neutral-500">Still need votes</div>
                <div className="text-2xl font-bold mt-1">{eventStats.unresolvedVotes}</div>
              </div>
              <div className="rounded-2xl bg-neutral-50 border p-4">
                <div className="text-sm text-neutral-500">Unclaimed items</div>
                <div className="text-2xl font-bold mt-1">{eventStats.missingItems}</div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm">
          <div>
            <div className="text-sm text-neutral-500">Best free slot today</div>
            {bestFreeSlotToday ? (
              <div className="mt-2">
                <div className="text-lg font-bold">Everyone free</div>
                <div className="text-sm text-neutral-500">
                  {bestFreeSlotToday.start.toLocaleString()} →{" "}
                  {bestFreeSlotToday.end.toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-500 mt-2">
                No full free slot found today.
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <button
              onClick={() => openModal()}
              className="rounded-xl border px-4 py-2 text-left font-medium transition-colors hover:bg-neutral-50"
            >
              + Create a hangout
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-semibold">Planning inbox</h2>
          <p className="text-sm text-neutral-500">
            Things that still need attention.
          </p>
        </div>

        <div className="space-y-3">
          {planningIssues.length === 0 ? (
            <div className="text-sm text-neutral-500">
              Everything looks organized right now.
            </div>
          ) : (
            planningIssues.map((issue) => (
              <div
                key={issue.id}
                className="rounded-2xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-neutral-50/50"
              >
                <div>
                  <div className="font-medium">{issue.title}</div>
                  <div className="text-sm text-neutral-500 capitalize">
                    {[
                      issue.missingLocation ? "location missing" : null,
                      issue.missingVotes > 0
                        ? `${issue.missingVotes} vote${issue.missingVotes > 1 ? "s" : ""} missing`
                        : null,
                      issue.missingItems > 0
                        ? `${issue.missingItems} item${issue.missingItems > 1 ? "s" : ""} unclaimed`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}