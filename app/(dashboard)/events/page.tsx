"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { supabase } from "@/lib/supabase/client";
import { useGroup } from "@/components/state/useGroup";
import { useModal } from "@/components/ui/useModal";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: {},
});

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  start: Date;
  end: Date;
};

type Vote = {
  id: string;
  event_id: string;
  user_id: string;
  vote_type: "yes" | "no" | "maybe";
};

type EventItem = {
  id: string;
  event_id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  note: string | null;
  claimed_by: string | null;
  checked: boolean;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default function EventsPage() {
  const { groupId, groupName } = useGroup();
  const { openModal } = useModal();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [items, setItems] = useState<EventItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("misc");

  async function loadProfilesForGroup() {
    if (!groupId) {
      setProfiles([]);
      return;
    }

    const { data: members } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    const ids = (members || []).map((m) => m.user_id);
    if (!ids.length) {
      setProfiles([]);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", ids);

    setProfiles(data || []);
  }

  async function load() {
    if (!groupId) {
      setEvents([]);
      return;
    }

    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("group_id", groupId)
      .order("start_time", { ascending: true });

    setEvents(
      (data || []).map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        location_name: e.location_name,
        start: new Date(e.start_time),
        end: new Date(e.end_time),
      }))
    );
  }

  async function loadVotes(eventId: string) {
    const { data } = await supabase
      .from("event_votes")
      .select("*")
      .eq("event_id", eventId);

    setVotes((data || []) as Vote[]);
  }

  async function loadItems(eventId: string) {
    const { data } = await supabase
      .from("event_items")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    setItems((data || []) as EventItem[]);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfilesForGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    function refresh() {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
      if (selected) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadVotes(selected.id);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadItems(selected.id);
      }
    }

    window.addEventListener("hangout:event-created", refresh);
    return () => window.removeEventListener("hangout:event-created", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, selected]);
  
  async function castVote(type: "yes" | "no" | "maybe") {
    if (!selected) return;

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return alert("Not logged in.");

    const { error } = await supabase.from("event_votes").upsert(
      {
        event_id: selected.id,
        user_id: user.id,
        vote_type: type,
      },
      { onConflict: "event_id,user_id" }
    );

    if (error) return alert(error.message);
    await loadVotes(selected.id);
  }

  async function addItem() {
    if (!selected) return;
    if (!newItemName.trim()) return alert("Enter an item name.");

    const { error } = await supabase.from("event_items").insert({
      event_id: selected.id,
      name: newItemName.trim(),
      quantity: newItemQty.trim() || null,
      category: newItemCategory,
    });

    if (error) return alert(error.message);

    setNewItemName("");
    setNewItemQty("");
    setNewItemCategory("misc");
    await loadItems(selected.id);
  }

  async function toggleClaim(item: EventItem) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return alert("Not logged in.");

    const claimedBy = item.claimed_by === user.id ? null : user.id;

    const { error } = await supabase
      .from("event_items")
      .update({ claimed_by: claimedBy })
      .eq("id", item.id);

    if (error) return alert(error.message);
    await loadItems(item.event_id);
  }

  async function toggleChecked(item: EventItem) {
    const { error } = await supabase
      .from("event_items")
      .update({ checked: !item.checked })
      .eq("id", item.id);

    if (error) return alert(error.message);
    await loadItems(item.event_id);
  }

  async function deleteItem(item: EventItem) {
    const { error } = await supabase
      .from("event_items")
      .delete()
      .eq("id", item.id);

    if (error) return alert(error.message);
    await loadItems(item.event_id);
  }

  const counts = useMemo(() => {
    return {
      yes: votes.filter((v) => v.vote_type === "yes").length,
      maybe: votes.filter((v) => v.vote_type === "maybe").length,
      no: votes.filter((v) => v.vote_type === "no").length,
    };
  }, [votes]);

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  return (
    <div className="h-full space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Shared calendar</h1>
        <p className="text-sm text-neutral-500">
          {groupName
            ? `Viewing calendar for ${groupName}`
            : "Select a group first to see and create events."}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="h-[72vh] bg-white border rounded-2xl p-2">
          <Calendar
            localizer={localizer}
            events={events}
            selectable
            onSelectSlot={(slotInfo) =>
              openModal({ start: slotInfo.start, end: slotInfo.end })
            }
            onSelectEvent={async (event) => {
              setSelected(event as CalendarEvent);
              await loadVotes(event.id);
              await loadItems(event.id);
            }}
            defaultView={Views.WEEK}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "100%" }}
          />
        </div>

        <div className="rounded-2xl border bg-white p-5 overflow-y-auto max-h-[72vh]">
          {!selected ? (
            <div className="text-sm text-neutral-500">
              Select a hangout on the calendar to view details, vote, and manage what people bring.
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold">{selected.title}</h2>
                <p className="text-sm text-neutral-500">
                  {selected.start.toLocaleString()} → {selected.end.toLocaleString()}
                </p>
                {selected.location_name && (
                  <p className="text-sm mt-2">
                    <span className="font-medium">Location:</span> {selected.location_name}
                  </p>
                )}
                {selected.description && (
                  <p className="text-sm text-neutral-600 mt-2">
                    {selected.description}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="font-semibold">Votes</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => castVote("yes")}
                    className="rounded-xl bg-black text-white px-3 py-2 text-sm"
                  >
                    Yes ({counts.yes})
                  </button>
                  <button
                    onClick={() => castVote("maybe")}
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    Maybe ({counts.maybe})
                  </button>
                  <button
                    onClick={() => castVote("no")}
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    No ({counts.no})
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">Bring list</div>
                </div>

                <div className="grid gap-2">
                  <input
                    className="rounded-xl border p-3"
                    placeholder="Item name (ice, speaker, drinks...)"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      className="rounded-xl border p-3"
                      placeholder="Quantity / note"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                    />
                    <select
                      className="rounded-xl border p-3"
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                    >
                      <option value="food">Food</option>
                      <option value="drinks">Drinks</option>
                      <option value="gear">Gear</option>
                      <option value="misc">Misc</option>
                    </select>
                    <button
                      onClick={addItem}
                      className="rounded-xl bg-black text-white px-4"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {items.length === 0 ? (
                    <div className="text-sm text-neutral-500">
                      No items yet.
                    </div>
                  ) : (
                    items.map((item) => {
                      const claimedProfile = item.claimed_by
                        ? profileMap.get(item.claimed_by)
                        : null;

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-neutral-500">
                                {[item.category, item.quantity]
                                  .filter(Boolean)
                                  .join(" · ") || "No extra details"}
                              </div>
                            </div>

                            <button
                              onClick={() => deleteItem(item)}
                              className="text-sm text-red-600"
                            >
                              Delete
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2 items-center">
                            <button
                              onClick={() => toggleClaim(item)}
                              className="rounded-xl border px-3 py-2 text-sm"
                            >
                              {item.claimed_by ? "Unclaim" : "I’ll bring this"}
                            </button>

                            <button
                              onClick={() => toggleChecked(item)}
                              className={`rounded-xl px-3 py-2 text-sm border ${
                                item.checked ? "bg-black text-white border-black" : ""
                              }`}
                            >
                              {item.checked ? "Packed" : "Mark packed"}
                            </button>

                            <div className="text-sm text-neutral-500">
                              {claimedProfile
                                ? `Claimed by ${claimedProfile.full_name || "friend"}`
                                : "Unclaimed"}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                onClick={() =>
                  openModal({
                    id: selected.id,
                    title: selected.title,
                    start: selected.start,
                    end: selected.end,
                  })
                }
                className="w-full rounded-xl border px-4 py-2"
              >
                Edit event
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}