/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useNavData } from "@/hooks/useNavData";
import { useEventsData } from "@/hooks/usePwaData";
import {
  Plus,
  MapPin,
  Shirt,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Trash2,
  Pencil,
  Calendar as CalendarIcon,
  List,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { DragSheet } from "@/components/ui/drag-sheet";
import { AddressAutocomplete, type AddressResult } from "@/components/ui/address-autocomplete";
import { NavigateSheet } from "@/components/ui/navigate-sheet";
import { cn } from "@/lib/utils";

const BOTTOM_NAV_HEIGHT = 49; // moet matchen met NavigationLayout.tsx nav-hoogte
const SHEET_BOTTOM_OFFSET = `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`;

type ViewType = "list" | "month";
type RsvpStatus = "going" | "not_going";

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}
type GroupProfiles = Record<string, Profile>;

interface EventRow {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  has_location: boolean;
  location_name: string | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  has_dresscode: boolean;
  dresscode: string | null;
  has_bring_list: boolean;
  created_by: string;
  created_at: string;
  event_rsvps: { user_id: string; status: RsvpStatus }[];
}

const WEEKDAY_LABELS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const MONTH_LABELS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

// Bouwt een 6-weken grid (42 dagen) voor de maandweergave, ma-start
function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // ma=0
  const gridStart = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function isMultiDay(ev: EventRow) {
  if (!ev.end_time) return false;
  return !isSameDay(new Date(ev.start_time), new Date(ev.end_time));
}

export default function EventsPage() {
  const { data: navData } = useNavData();

  const activeGroupId = navData?.activeGroup?.id ?? null;
  const userId = navData?.user?.id ?? null;
  const safeGroupId = activeGroupId ?? "";
  const { events, groupProfiles, mutate } = useEventsData(safeGroupId);

  const [currentView, setCurrentView] = useState<ViewType>("list");
  const [monthCursor, setMonthCursor] = useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [rsvpBusyId, setRsvpBusyId] = useState<string | null>(null);
  const [navigateTarget, setNavigateTarget] = useState<EventRow | null>(null);

  // create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [hasEnd, setHasEnd] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hasLocation, setHasLocation] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [location, setLocation] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hasDresscode, setHasDresscode] = useState(false);
  const [dresscode, setDresscode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sortedEvents: EventRow[] = useMemo(
    () => [...events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [events]
  );

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return sortedEvents.filter((ev) => {
      const end = ev.end_time ? new Date(ev.end_time) : new Date(ev.start_time);
      return end >= startOfDay(now);
    });
  }, [sortedEvents]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const ev of sortedEvents) {
      const start = startOfDay(new Date(ev.start_time));
      const end = ev.end_time ? startOfDay(new Date(ev.end_time)) : start;
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = cursor.toDateString();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [sortedEvents]);

  const monthGrid = useMemo(
    () => buildMonthGrid(monthCursor.getFullYear(), monthCursor.getMonth()),
    [monthCursor]
  );

  if (!activeGroupId) {
    return (
      <div className="p-10 text-center text-sm font-bold text-muted-foreground">
        Selecteer eerst een groep om de agenda te bekijken.
      </div>
    );
  }
  if (!userId) {
    return (
      <div className="p-10 text-center text-sm font-bold text-muted-foreground">
        Je bent niet ingelogd.
      </div>
    );
  }
  const uid = userId;

  function openEditSheet(ev: EventRow) {
    setEditingEvent(ev);
    setTitle(ev.title);
    setDescription(ev.description ?? "");
    const start = new Date(ev.start_time);
    setStartDate(start.toISOString().slice(0, 10));
    setStartTime(start.toISOString().slice(11, 16));
    if (ev.end_time) {
      const end = new Date(ev.end_time);
      setHasEnd(true);
      setEndDate(end.toISOString().slice(0, 10));
      setEndTime(end.toISOString().slice(11, 16));
    } else {
      setHasEnd(false);
      setEndDate("");
      setEndTime("");
    }
    setHasLocation(ev.has_location);
    setLocationName(ev.location_name ?? "");
    setLocation(ev.location ?? "");
    setLocationCoords(
      ev.location_lat != null && ev.location_lng != null
        ? { lat: ev.location_lat, lng: ev.location_lng }
        : null
    );
    setHasDresscode(ev.has_dresscode);
    setDresscode(ev.dresscode ?? "");
    setFormError(null);
    setShowCreateSheet(true);
  }

  function resetForm() {
    setEditingEvent(null);
    setTitle("");
    setDescription("");
    setStartDate("");
    setStartTime("");
    setHasEnd(false);
    setEndDate("");
    setEndTime("");
    setHasLocation(false);
    setLocationName("");
    setLocation("");
    setLocationCoords(null);
    setHasDresscode(false);
    setDresscode("");
    setFormError(null);
  }

  async function handleRsvp(ev: EventRow, status: RsvpStatus) {
    if (rsvpBusyId === ev.id) return;
    setRsvpBusyId(ev.id);

    const previous = events;
    mutate(
      (old: any) => {
        if (!old) return old;
        return {
          ...old,
          events: old.events.map((e: EventRow) => {
            if (e.id !== ev.id) return e;
            const withoutMe = e.event_rsvps.filter((r) => r.user_id !== uid);
            return { ...e, event_rsvps: [...withoutMe, { user_id: uid, status }] };
          }),
        };
      },
      false
    );

    try {
      const { error: delError } = await supabase
        .from("event_rsvps")
        .delete()
        .eq("event_id", ev.id)
        .eq("user_id", uid);
      if (delError) throw delError;

      const { error: insError } = await supabase
        .from("event_rsvps")
        .insert({ event_id: ev.id, user_id: uid, status });
      if (insError) throw insError;

      await mutate();
    } catch {
      mutate(previous, false);
    } finally {
      setRsvpBusyId(null);
    }
  }

  async function handleDeleteEvent(ev: EventRow) {
    if (ev.created_by !== uid) return; // extra guard, RLS dekt dit al af
    const confirmed = window.confirm(`"${ev.title}" verwijderen? Dit kan niet ongedaan gemaakt worden.`);
    if (!confirmed) return;

    const previous = events;
    mutate(
      (old: any) => old ? { ...old, events: old.events.filter((e: EventRow) => e.id !== ev.id) } : old,
      false
    );

    const { error } = await supabase.from("events").delete().eq("id", ev.id);
    if (error) {
      mutate(previous, false);
      window.alert("Verwijderen mislukt: " + error.message);
      return;
    }
    setExpandedId((cur) => (cur === ev.id ? null : cur));
    mutate();
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!title || !startDate || !startTime) {
      setFormError("Titel, datum en starttijd zijn verplicht.");
      return;
    }
    if (hasEnd && (!endDate || !endTime)) {
      setFormError("Vul een einddatum en -tijd in, of zet het eindmoment uit.");
      return;
    }

    const startIso = new Date(`${startDate}T${startTime}`).toISOString();
    const endIso = hasEnd ? new Date(`${endDate}T${endTime}`).toISOString() : null;

    if (endIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setFormError("De stoptijd moet na de starttijd liggen. Een activiteit kan geen 0 of negatieve duur hebben.");
      return;
    }

    setSubmitting(true);

    if (editingEvent) {
      const { error } = await supabase
        .from("events")
        .update({
          title,
          description: description || null,
          start_time: startIso,
          end_time: endIso,
          has_location: hasLocation,
          location_name: hasLocation ? locationName || null : null,
          location: hasLocation ? location || null : null,
          location_lat: hasLocation ? locationCoords?.lat ?? null : null,
          location_lng: hasLocation ? locationCoords?.lng ?? null : null,
          has_dresscode: hasDresscode,
          dresscode: hasDresscode ? dresscode || null : null,
        })
        .eq("id", editingEvent.id);

      setSubmitting(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.rpc("create_event_atomic", {
        p_group_id: activeGroupId,
        p_title: title,
        p_description: description || null,
        p_start_time: startIso,
        p_end_time: endIso,
        p_has_location: hasLocation,
        p_location_name: hasLocation ? locationName || null : null,
        p_location: hasLocation ? location || null : null,
        p_has_dresscode: hasDresscode,
        p_dresscode: hasDresscode ? dresscode || null : null,
        p_has_bring_list: false,
        p_location_lat: hasLocation ? locationCoords?.lat ?? null : null,
        p_location_lng: hasLocation ? locationCoords?.lng ?? null : null,
      });

      setSubmitting(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    }

    setShowCreateSheet(false);
    resetForm();
    mutate();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24">
      {/* HEADER */}
      <div className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-xl font-black tracking-tight">Agenda</h1>
          <p className="text-xs text-muted-foreground">{navData?.activeGroup?.name}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreateSheet(true); }}
          className="text-xs font-bold bg-btn-bg text-btn-text px-3.5 py-2.5 rounded-2xl flex items-center gap-1 active:scale-95 transition-transform"
        >
          <Plus size={14} strokeWidth={2.5} /> Nieuw
        </button>
      </div>

      {/* VIEW SWITCH */}
      <div className="flex gap-1 bg-container-bg rounded-2xl p-1 w-fit">
        <button
          onClick={() => setCurrentView("list")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
            currentView === "list" ? "bg-btn-bg text-btn-text" : "text-muted-foreground"
          )}
        >
          <List size={13} /> Lijst
        </button>
        <button
          onClick={() => setCurrentView("month")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
            currentView === "month" ? "bg-btn-bg text-btn-text" : "text-muted-foreground"
          )}
        >
          <CalendarIcon size={13} /> Maand
        </button>
      </div>

      {currentView === "month" && (
        <MonthView
          monthCursor={monthCursor}
          setMonthCursor={setMonthCursor}
          grid={monthGrid}
          eventsByDay={eventsByDay}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
        />
      )}

      {currentView === "month" && selectedDay && (
        <DayAgenda
          day={selectedDay}
          events={eventsByDay.get(selectedDay.toDateString()) ?? []}
          uid={uid}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          onRsvp={handleRsvp}
          rsvpBusyId={rsvpBusyId}
          onDelete={handleDeleteEvent}
          onEdit={openEditSheet}
          groupProfiles={groupProfiles}
          onNavigate={setNavigateTarget}
        />
      )}

      {currentView === "list" && (
        <ListView
          events={upcomingEvents}
          uid={uid}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          onRsvp={handleRsvp}
          rsvpBusyId={rsvpBusyId}
          onDelete={handleDeleteEvent}
          onEdit={openEditSheet}
          groupProfiles={groupProfiles}
          onNavigate={setNavigateTarget}
        />
      )}

      {/* CREATE / EDIT SHEET */}
      <CreateEventSheet
        open={showCreateSheet}
        isEditing={!!editingEvent}
        onClose={() => { setShowCreateSheet(false); resetForm(); }}
        title={title} setTitle={setTitle}
        description={description} setDescription={setDescription}
        startDate={startDate} setStartDate={setStartDate}
        startTime={startTime} setStartTime={setStartTime}
        hasEnd={hasEnd} setHasEnd={setHasEnd}
        endDate={endDate} setEndDate={setEndDate}
        endTime={endTime} setEndTime={setEndTime}
        hasLocation={hasLocation} setHasLocation={setHasLocation}
        locationName={locationName} setLocationName={setLocationName}
        location={location} setLocation={setLocation}
        onLocationSelect={(r: AddressResult) => setLocationCoords({ lat: r.lat, lng: r.lng })}
        hasDresscode={hasDresscode} setHasDresscode={setHasDresscode}
        dresscode={dresscode} setDresscode={setDresscode}
        formError={formError}
        submitting={submitting}
        onSubmit={saveEvent}
      />

      <NavigateSheet
        open={!!navigateTarget}
        onClose={() => setNavigateTarget(null)}
        lat={navigateTarget?.location_lat ?? null}
        lng={navigateTarget?.location_lng ?? null}
        address={navigateTarget?.location ?? null}
      />
    </div>
  );
}

// ============================================================
// Maandweergave
// ============================================================
function MonthView({
  monthCursor, setMonthCursor, grid, eventsByDay, selectedDay, setSelectedDay,
}: {
  monthCursor: Date;
  setMonthCursor: (d: Date) => void;
  grid: Date[];
  eventsByDay: Map<string, EventRow[]>;
  selectedDay: Date | null;
  setSelectedDay: (d: Date | null) => void;
}) {
  const today = new Date();

  function shiftMonth(delta: number) {
    const next = new Date(monthCursor);
    next.setMonth(next.getMonth() + delta);
    setMonthCursor(next);
    setSelectedDay(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => shiftMonth(-1)}
          className="size-8 flex items-center justify-center rounded-full hover:bg-container-bg active:scale-90 transition-transform"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="font-bold text-sm capitalize">
          {MONTH_LABELS[monthCursor.getMonth()]} {monthCursor.getFullYear()}
        </span>
        <button
          onClick={() => shiftMonth(1)}
          className="size-8 flex items-center justify-center rounded-full hover:bg-container-bg active:scale-90 transition-transform"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {grid.map((day, i) => {
          const inMonth = day.getMonth() === monthCursor.getMonth();
          const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
          const isToday = isSameDay(day, today);
          const isSelected = selectedDay && isSameDay(day, selectedDay);

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className="flex flex-col items-center gap-1 py-1"
            >
              <span
                className={cn(
                  "size-7 flex items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  !inMonth && "text-muted-foreground/40",
                  inMonth && !isSelected && !isToday && "text-foreground",
                  isToday && !isSelected && "text-btn-bg font-black",
                  isSelected && "bg-btn-bg text-btn-text"
                )}
              >
                {day.getDate()}
              </span>
              <div className="flex gap-0.5 h-1.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <span key={ev.id} className="size-1.5 rounded-full bg-foreground/60" />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Dag-detail onder de maandkalender
// ============================================================
function DayAgenda({
  day, events, uid, expandedId, setExpandedId, onRsvp, rsvpBusyId, onDelete, onEdit, groupProfiles, onNavigate,
}: {
  day: Date;
  events: EventRow[];
  uid: string;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onRsvp: (ev: EventRow, status: RsvpStatus) => void;
  rsvpBusyId: string | null;
  onDelete: (ev: EventRow) => void;
  onEdit: (ev: EventRow) => void;
  groupProfiles: GroupProfiles;
  onNavigate: (ev: EventRow) => void;
}) {
  return (
    <div className="space-y-2 pt-1 animate-in fade-in-0 slide-in-from-top-1 duration-150">
      <p className="text-xs font-bold text-muted-foreground capitalize px-1">
        {day.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })}
      </p>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1">Geen activiteiten op deze dag.</p>
      ) : (
        events.map((ev) => (
          <EventCard
            key={ev.id}
            ev={ev}
            uid={uid}
            expanded={expandedId === ev.id}
            onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
            onRsvp={onRsvp}
            busy={rsvpBusyId === ev.id}
            onDelete={onDelete}
            onEdit={onEdit}
            groupProfiles={groupProfiles}
            onNavigate={onNavigate}
          />
        ))
      )}
    </div>
  );
}

// ============================================================
// Lijstweergave
// ============================================================
function ListView({
  events, uid, expandedId, setExpandedId, onRsvp, rsvpBusyId, onDelete, onEdit, groupProfiles, onNavigate,
}: {
  events: EventRow[];
  uid: string;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onRsvp: (ev: EventRow, status: RsvpStatus) => void;
  rsvpBusyId: string | null;
  onDelete: (ev: EventRow) => void;
  onEdit: (ev: EventRow) => void;
  groupProfiles: GroupProfiles;
  onNavigate: (ev: EventRow) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="py-16 text-center space-y-1.5">
        <p className="text-sm font-bold text-foreground">Nog geen activiteiten gepland</p>
        <p className="text-xs text-muted-foreground">Tik op &apos;Nieuw&apos; om er een te plannen.</p>
      </div>
    );
  }

  // groeperen per dag-label voor duidelijke scheiding
  const groups: { label: string; items: EventRow[] }[] = [];
  for (const ev of events) {
    const label = formatDayLabel(ev.start_time);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(ev);
    else groups.push({ label, items: [ev] });
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label} className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground capitalize px-1">{g.label}</p>
          <div className="space-y-2">
            {g.items.map((ev) => (
              <EventCard
                key={ev.id}
                ev={ev}
                uid={uid}
                expanded={expandedId === ev.id}
                onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                onRsvp={onRsvp}
                busy={rsvpBusyId === ev.id}
                onDelete={onDelete}
                onEdit={onEdit}
                groupProfiles={groupProfiles}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Event kaart (samengevouwen + expand)
// ============================================================
function EventCard({
  ev, uid, expanded, onToggle, onRsvp, busy, onDelete, onEdit, groupProfiles, onNavigate,
}: {
  ev: EventRow;
  uid: string;
  expanded: boolean;
  onToggle: () => void;
  onRsvp: (ev: EventRow, status: RsvpStatus) => void;
  busy: boolean;
  onDelete: (ev: EventRow) => void;
  onEdit: (ev: EventRow) => void;
  groupProfiles: GroupProfiles;
  onNavigate: (ev: EventRow) => void;
}) {
  const myRsvp = ev.event_rsvps.find((r) => r.user_id === uid)?.status ?? null;
  const going = ev.event_rsvps.filter((r) => r.status === "going");
  const notGoing = ev.event_rsvps.filter((r) => r.status === "not_going");
  const multiDay = isMultiDay(ev);

  return (
    <div className="rounded-2xl bg-container-bg overflow-hidden transition-all">
      <button onClick={onToggle} className="w-full text-left p-3.5 flex items-start gap-3">
        <div className="flex flex-col items-center justify-center w-11 shrink-0 pt-0.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">
            {new Date(ev.start_time).toLocaleDateString("nl-BE", { month: "short" })}
          </span>
          <span className="text-lg font-black leading-none">
            {new Date(ev.start_time).getDate()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm truncate">{ev.title}</h3>
            {multiDay && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-foreground/10 text-muted-foreground shrink-0">
                meerdaags
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatTime(ev.start_time)}
            {ev.end_time && ` – ${multiDay ? new Date(ev.end_time).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }) + " " : ""}${formatTime(ev.end_time)}`}
            {ev.has_location && ev.location_name && (
              <span className="inline-flex items-center gap-0.5 ml-1.5">
                <MapPin size={10} className="inline -mt-0.5" /> {ev.location_name}
              </span>
            )}
          </p>
        </div>

        {going.length > 0 && (
          <AvatarGroup className="shrink-0 mt-0.5">
            {going.slice(0, 3).map((r) => {
              const profile = groupProfiles[r.user_id];
              return (
                <Avatar key={r.user_id} size="sm" title={profile?.full_name ?? undefined}>
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />}
                  <AvatarFallback>
                    {(profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              );
            })}
          </AvatarGroup>
        )}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 pt-0.5 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {ev.description && (
            <p className="text-xs text-foreground/80 leading-relaxed">{ev.description}</p>
          )}

          {ev.has_location && ev.location && (
            <button
              type="button"
              onClick={() => onNavigate(ev)}
              className="flex items-center gap-1.5 text-xs text-primary font-medium underline decoration-primary/30 decoration-1 underline-offset-2 active:opacity-60 transition-opacity"
            >
              <MapPin size={12} /> {ev.location}
            </button>
          )}
          {ev.has_dresscode && ev.dresscode && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shirt size={12} /> {ev.dresscode}
            </div>
          )}

          {/* RSVP knoppen: niet voor de aanmaker (die komt sowieso), voor
              anderen neutraal tot ze kiezen, daarna switchable */}
          {ev.created_by !== uid && (
            <div className="flex gap-2 pt-1">
              <button
                disabled={busy}
                onClick={() => myRsvp !== "going" && onRsvp(ev, "going")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border",
                  myRsvp === "going"
                    ? "bg-green-500/10 text-green-600 border-green-500/30"
                    : "bg-background text-foreground border-border"
                )}
              >
                <Check size={13} /> Ik kom
              </button>
              <button
                disabled={busy}
                onClick={() => myRsvp !== "not_going" && onRsvp(ev, "not_going")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border",
                  myRsvp === "not_going"
                    ? "bg-red-500/10 text-red-600 border-red-500/30"
                    : "bg-background text-foreground border-border"
                )}
              >
                <X size={13} /> Kan niet
              </button>
            </div>
          )}

          {/* Deelnemerslijst: groen = komt, rood + greyed-out = komt niet */}
          {(going.length > 0 || notGoing.length > 0) && (
            <div className="flex flex-wrap gap-3 pt-1">
              {going.map((r) => {
                const profile = groupProfiles[r.user_id];
                return (
                  <div key={r.user_id} className="flex flex-col items-center gap-1 w-12">
                    <Avatar size="sm" className="ring-2 ring-green-500 ring-offset-2 ring-offset-container-bg">
                      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />}
                      <AvatarFallback>{(profile?.full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-[9px] font-bold text-foreground truncate w-full text-center">
                      {profile?.full_name?.split(" ")[0] ?? "?"}
                    </span>
                  </div>
                );
              })}
              {notGoing.map((r) => {
                const profile = groupProfiles[r.user_id];
                return (
                  <div key={r.user_id} className="flex flex-col items-center gap-1 w-12 opacity-40">
                    <Avatar size="sm" className="ring-2 ring-red-500 ring-offset-2 ring-offset-container-bg grayscale">
                      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />}
                      <AvatarFallback>{(profile?.full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-[9px] font-bold text-muted-foreground truncate w-full text-center">
                      {profile?.full_name?.split(" ")[0] ?? "?"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bewerk + Verwijderen: enkel zichtbaar voor de aanmaker */}
          {ev.created_by === uid && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onEdit(ev)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-foreground bg-background border border-border active:scale-95 transition-all"
              >
                <Pencil size={13} /> Bewerk
              </button>
              <button
                onClick={() => onDelete(ev)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-destructive bg-destructive/10 active:scale-95 transition-all"
              >
                <Trash2 size={13} /> Verwijder
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Create sheet
// ============================================================
function CreateEventSheet(props: any) {
  const {
    open, onClose, isEditing,
    title, setTitle, description, setDescription,
    startDate, setStartDate, startTime, setStartTime,
    hasEnd, setHasEnd, endDate, setEndDate, endTime, setEndTime,
    hasLocation, setHasLocation, locationName, setLocationName, location, setLocation, onLocationSelect,
    hasDresscode, setHasDresscode, dresscode, setDresscode,
    formError, submitting, onSubmit,
  } = props;

  return (
    <DragSheet
      open={open}
      onClose={onClose}
      title={isEditing ? "Activiteit bewerken" : "Nieuwe activiteit"}
      bottomOffset={SHEET_BOTTOM_OFFSET}
      className="max-h-[85dvh]"
    >
      <form onSubmit={onSubmit} className="p-4 space-y-3">
        <input
          placeholder="Titel"
          value={title}
          onChange={(e: any) => setTitle(e.target.value)}
          className="w-full bg-background p-3 text-sm rounded-xl outline-none"
        />
        <textarea
          placeholder="Beschrijving (optioneel)"
          value={description}
          onChange={(e: any) => setDescription(e.target.value)}
          className="w-full bg-background p-3 text-sm rounded-xl outline-none resize-none"
          rows={2}
        />

        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase px-1 mb-1">Start</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[9px] font-bold text-muted-foreground px-1 mb-0.5">Datum</p>
              <input type="date" value={startDate} onChange={(e: any) => setStartDate(e.target.value)}
                className="w-full bg-background p-3 text-sm rounded-xl outline-none" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground px-1 mb-0.5">Uur</p>
              <input type="time" value={startTime} onChange={(e: any) => setStartTime(e.target.value)}
                className="w-full bg-background p-3 text-sm rounded-xl outline-none" />
            </div>
          </div>
        </div>

        <ToggleRow label="Eindmoment toevoegen" checked={hasEnd} onChange={setHasEnd} />
        {hasEnd && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase px-1 mb-1">Einde</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] font-bold text-muted-foreground px-1 mb-0.5">Datum</p>
                <input type="date" value={endDate} onChange={(e: any) => setEndDate(e.target.value)}
                  className="w-full bg-background p-3 text-sm rounded-xl outline-none" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-muted-foreground px-1 mb-0.5">Uur</p>
                <input type="time" value={endTime} onChange={(e: any) => setEndTime(e.target.value)}
                  className="w-full bg-background p-3 text-sm rounded-xl outline-none" />
              </div>
            </div>
          </div>
        )}

        <ToggleRow label="Locatie toevoegen" checked={hasLocation} onChange={setHasLocation} />
        {hasLocation && (
          <div className="space-y-2">
            <input placeholder="Naam locatie (bv. Bij Sam)" value={locationName}
              onChange={(e: any) => setLocationName(e.target.value)}
              className="w-full bg-background p-3 text-sm rounded-xl outline-none" />
            <AddressAutocomplete
              value={location}
              onChange={setLocation}
              onSelect={onLocationSelect}
              placeholder="Adres (kies uit de suggesties)"
            />
          </div>
        )}

        <ToggleRow label="Dresscode toevoegen" checked={hasDresscode} onChange={setHasDresscode} />
        {hasDresscode && (
          <input placeholder="Dresscode" value={dresscode}
            onChange={(e: any) => setDresscode(e.target.value)}
            className="w-full bg-background p-3 text-sm rounded-xl outline-none" />
        )}

        {formError && <p className="text-xs text-destructive font-medium">{formError}</p>}

        <button
          disabled={submitting}
          className="w-full bg-btn-bg text-btn-text text-sm font-bold py-3 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {submitting ? (isEditing ? "Opslaan..." : "Aanmaken...") : (isEditing ? "Opslaan" : "Aanmaken")}
        </button>
      </form>
    </DragSheet>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between py-1"
    >
      <span className="text-sm font-medium">{label}</span>
      <span
        className={cn(
          "w-10 h-6 rounded-full transition-colors relative",
          checked ? "bg-btn-bg" : "bg-container-bg"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-background transition-transform shadow-sm",
            checked ? "translate-x-4.5 left-0.5" : "translate-x-0 left-0.5"
          )}
        />
      </span>
    </button>
  );
}