/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useNavData } from "@/hooks/useNavData";
import { useEventsData } from "@/hooks/usePwaData";
import { Plus, ShoppingBag, Heart, ArrowRight, Navigation, X, MapPin } from "lucide-react";

type ViewType = "day" | "week" | "month" | "6month";

export default function EventsPage() {
  const { data: navData } = useNavData();

  const activeGroupId = navData?.activeGroup?.id;
  const userId = navData?.user?.id;

  // ✅ minimal TS fix (no behavior change)
  const uid = userId as string;

  const { events, groupProfiles, mutate } = useEventsData(activeGroupId);

  const [currentView, setCurrentView] = useState<ViewType>("month");
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const [eventType, setEventType] = useState<"hangout" | "trip">("hangout");

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [locationAddress, setLocationAddress] = useState("");
  const [dresscode, setDresscode] = useState("");

  const [endTime, setEndTime] = useState("");
  const [hasEndTime, setHasEndTime] = useState(false);

  const [endDate, setEndDate] = useState("");
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  const [stopInput, setStopInput] = useState("");

  const [bringInput, setBringInput] = useState("");
  const [bringList, setBringList] = useState<string[]>([]);

  const [formError, setFormError] = useState<string | null>(null);

  // 🔒 GROUP SAFETY GUARD
  if (!activeGroupId) {
    return (
      <div className="p-10 text-center text-sm font-bold text-neutral-500">
        Selecteer eerst een groep om events te bekijken.
      </div>
    );
  }

  // 🔒 USER SAFETY GUARD (UNCHANGED LOGIC, STILL SAFE)
  if (!userId) {
    return (
      <div className="p-10 text-center text-sm font-bold text-neutral-500">
        User niet ingelogd.
      </div>
    );
  }

  // ---------- FILTER EVENTS BY VIEW ----------
  const filteredEvents = useMemo(() => {
    const now = new Date();

    return [...events]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .filter((event) => {
        const d = new Date(event.date);

        if (currentView === "day") return d.toDateString() === now.toDateString();

        if (currentView === "week") {
          const start = new Date(now);
          start.setDate(now.getDate() - now.getDay());
          const end = new Date(start);
          end.setDate(start.getDate() + 7);
          return d >= start && d <= end;
        }

        if (currentView === "month") {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }

        if (currentView === "6month") {
          const future = new Date(now);
          future.setMonth(now.getMonth() + 6);
          return d >= now && d <= future;
        }

        return true;
      });
  }, [events, currentView]);

  // ---------- ATTENDANCE ----------
  async function toggleAttendance(event: any) {
    const attendees: string[] = event.attendees || [];

    const updated = attendees.includes(uid)
      ? attendees.filter((id) => id !== uid)
      : [...attendees, uid];

    mutate(
      (old: any) => ({
        ...old,
        events: old.events.map((e: any) =>
          e.id === event.id ? { ...e, attendees: updated } : e
        ),
      }),
      false
    );

    await supabase.from("events").update({ attendees: updated }).eq("id", event.id);
    mutate();
  }

  // ---------- CREATE EVENT ----------
  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!title || !date || !locationAddress) {
      setFormError("Vul alle verplichte velden in.");
      return;
    }

    const payload: any = {
      group_id: activeGroupId,
      created_by: uid,

      title,
      date,
      event_type: eventType,

      location_address: locationAddress,
      dresscode: dresscode || null,

      bring_list: bringList.map((item) => ({ item, claims: [] })),
      attendees: [uid],
    };

    if (eventType === "hangout") {
      payload.time = time || null;
      payload.end_time = hasEndTime ? endTime : null;
    }

    if (eventType === "trip") {
      payload.end_date = endDate || null;
      payload.start_location = startLocation || null;
      payload.end_location = endLocation || null;
      payload.intermediate_stops = stops;
    }

    const tempId = crypto.randomUUID();

    mutate(
      (old: any) => ({
        ...old,
        events: [...old.events, { id: tempId, ...payload }],
      }),
      false
    );

    setShowCreateSheet(false);

    const { error } = await supabase.from("events").insert(payload);

    if (error) {
      setFormError(error.message);
    }

    mutate();
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-xl font-black">Agenda</h1>
          <p className="text-xs text-neutral-500">Events per groep</p>
        </div>

        <button
          onClick={() => setShowCreateSheet(true)}
          className="text-xs font-bold bg-black text-white px-3 py-2 rounded-xl flex items-center gap-1"
        >
          <Plus size={14} /> Nieuw
        </button>
      </div>

      {/* VIEW SWITCH */}
      <div className="flex gap-2 text-xs font-bold">
        {(["day", "week", "month", "6month"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setCurrentView(v)}
            className={`px-2 py-1 rounded ${
              currentView === v ? "bg-black text-white" : "bg-neutral-100"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* EVENTS */}
      {filteredEvents.length === 0 ? (
        <p className="text-xs text-neutral-500">Geen events</p>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const going = event.attendees?.includes(uid);

            return (
              <div key={event.id} className="border p-3 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <h3 className="font-bold">{event.title}</h3>

                  <button
                    onClick={() => toggleAttendance(event)}
                    className={`text-xs px-2 py-1 rounded ${
                      going ? "bg-red-100" : "bg-neutral-100"
                    }`}
                  >
                    {going ? "Ik ga" : "Ga mee"}
                  </button>
                </div>

                <p className="text-xs text-neutral-500">{event.location_address}</p>

                <div className="flex gap-2 text-xs text-neutral-400">
                  {event.attendees?.length || 0} deelnemers
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateSheet && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center">
          <form
            onSubmit={createEvent}
            className="bg-white w-full max-w-md p-4 rounded-t-2xl space-y-3"
          >
            <input
              placeholder="Titel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border p-2 text-xs"
            />

            <input
              placeholder="Locatie"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              className="w-full border p-2 text-xs"
            />

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border p-2 text-xs"
            />

            {formError && (
              <p className="text-xs text-red-500">{formError}</p>
            )}

            <button className="w-full bg-black text-white text-xs py-2 rounded">
              Aanmaken
            </button>

            <button
              type="button"
              onClick={() => setShowCreateSheet(false)}
              className="w-full text-xs"
            >
              sluiten
            </button>
          </form>
        </div>
      )}
    </div>
  );
}