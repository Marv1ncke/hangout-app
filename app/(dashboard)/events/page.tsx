/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useNavData } from "../../../hooks/useNavData";
import { useEventsData } from "@/hooks/usePwaData";
import { Plus, ShoppingBag, Heart, ArrowRight, Navigation, X, MapPin } from "lucide-react";

type ViewType = "day" | "week" | "month" | "6month";

export default function EventsPage() {
  // 1. READ FROM THE INVISIBLE GLOBAL STORE INSTANTLY ($0ms)
  const { data: navData } = useNavData();
  const activeGroupId = (navData as any)?.activeGroup?.id;
  const userId = (navData as any)?.profile?.id || "";

  // 2. CONNECT ACTIVE SYNCED CACHE
  const { events, groupProfiles, mutate: mutateEvents } = useEventsData(activeGroupId);
  
  // 3. KEEP YOUR PERFECT LOCAL FORM STATES
  const [currentView, setCurrentView] = useState<ViewType>("month");
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  
  const [eventType, setEventType] = useState<"hangout" | "trip">("hangout");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [hasEndTime, setHasEndTime] = useState(false);
  const [endTime, setEndTime] = useState(""); 
  const [locationAddress, setLocationAddress] = useState(""); 
  const [endDate, setEndDate] = useState("");
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const [dresscode, setDresscode] = useState("");
  const [stopInput, setStopInput] = useState("");
  const [stops, setStops] = useState<string[]>([]);
  
  const [formError, setFormError] = useState<string | null>(null);
  const [modalBringInput, setModalBringInput] = useState("");
  const [modalBringList, setModalBringList] = useState<string[]>([]);
  const [newEventItem, setNewEventItem] = useState<{ [eventId: string]: string }>({});

  // 4. MAP DATA LOCALLY (NO EXTRA DB QUERIES)
  const filteredEvents = (() => {
    const now = new Date();
    const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sorted.filter(event => {
      const eventDate = new Date(event.date);
      if (currentView === "day") return eventDate.toDateString() === now.toDateString();
      if (currentView === "week") {
        const currentDay = now.getDay();
        const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - distanceToMonday);
        monday.setHours(0,0,0,0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23,59,59,999);
        return eventDate >= monday && eventDate <= sunday;
      }
      if (currentView === "month") return eventDate.getMonth() === now.getMonth() && eventDate.getFullYear() === now.getFullYear();
      if (currentView === "6month") {
        const sixMonthsFromNow = new Date(now);
        sixMonthsFromNow.setMonth(now.getMonth() + 6);
        return eventDate >= now && eventDate <= sixMonthsFromNow;
      }
      return true;
    });
  })();

  const getDutchDayName = (dateStr: string) => {
    const days = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
    return days[new Date(dateStr).getDay()];
  };

  const formatEndDateTime = (dateTimeStr: string) => {
    try {
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return dateTimeStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month} om ${hours}:${minutes}`;
    } catch {
      return dateTimeStr;
    }
  };

  // 5. INSTANT PERCEPTION OPTIMISTIC MUTATIONS
  async function toggleAttendance(event: any) {
    const current = event.attendees || [];
    const updated = current.includes(userId) ? current.filter((id: string) => id !== userId) : [...current, userId];
    
    // UI updates instantly to the user
    mutateEvents((old: any) => ({
      ...old,
      events: old.events.map((e: any) => e.id === event.id ? { ...e, attendees: updated } : e)
    }), false);

    await supabase.from("events").update({ attendees: updated }).eq("id", event.id);
    mutateEvents(); // Quiet background validation check
  }

  async function claimItem(event: any, itemIndex: number) {
    const currentName = groupProfiles[userId]?.full_name?.split(" ")[0] || "Lid";
    const updatedList = [...(event.bring_list || [])];
    const targetItem = updatedList[itemIndex];

    if (!targetItem.claims) {
      targetItem.claims = [];
      if (targetItem.claimed_by) {
        targetItem.claims.push({ user_id: targetItem.claimed_by, name: targetItem.claimed_name || "Lid" });
        delete targetItem.claimed_by;
        delete targetItem.claimed_name;
      }
    }

    const existingClaimIndex = targetItem.claims.findIndex((c: any) => c.user_id === userId);
    if (existingClaimIndex > -1) {
      targetItem.claims.splice(existingClaimIndex, 1);
    } else {
      targetItem.claims.push({ user_id: userId, name: currentName });
    }

    // UI updates instantly to the user
    mutateEvents((old: any) => ({
      ...old,
      events: old.events.map((e: any) => e.id === event.id ? { ...e, bring_list: updatedList } : e)
    }), false);

    await supabase.from("events").update({ bring_list: updatedList }).eq("id", event.id);
    mutateEvents();
  }

  async function addNewItemToExistingEvent(eventId: string) {
    const text = newEventItem[eventId];
    if (!text?.trim()) return;
    const event = events.find((e: any) => e.id === eventId);
    if (!event) return;

    const currentList = event.bring_list || [];
    const updatedList = [...currentList, { item: text.trim(), claims: [] }];

    setNewEventItem({ ...newEventItem, [eventId]: "" });

    // UI updates instantly to the user
    mutateEvents((old: any) => ({
      ...old,
      events: old.events.map((e: any) => e.id === eventId ? { ...e, bring_list: updatedList } : e)
    }), false);

    await supabase.from("events").update({ bring_list: updatedList }).eq("id", eventId);
    mutateEvents();
  }

  return (
    <div className="space-y-6 select-none animate-in fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Agenda</h1>
          <p className="text-xs font-bold text-neutral-400 mt-0.5">Mis niks. Zie direct wie er meegaat en verdeel de taken.</p>
        </div>
        <button 
          onClick={() => { setFormError(null); setShowCreateSheet(true); }} 
          className="sm:px-3.5 py-2 bg-btn-bg text-btn-text text-xs font-bold rounded-xl active:scale-95 transition flex items-center justify-center gap-1"
        >
          <Plus size={14} /> Nieuw Event Plannen
        </button>
      </div>

      {/* MINIMALISTISCHE TIMELINE TOGGLE */}
      <div className="flex items-center justify-between bg-background p-1 rounded-xl border border-border max-w-md">
        {(["day", "week", "month", "6month"] as const).map((view) => (
          <button
            key={view}
            onClick={() => setCurrentView(view)}
            className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition capitalize ${currentView === view ? "bg-container-bg text-foreground shadow-3xs border border-border/40" : "text-neutral-400 hover:text-neutral-600"}`}
          >
            {view === "day" ? "Vandaag" : view === "week" ? "Week" : view === "month" ? "Maand" : "6 Maanden"}
          </button>
        ))}
      </div>

      {/* INSTAGRAM-STYLE VLAKKE GRID */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 bg-background rounded-2xl border border-border">
          <p className="text-xs font-bold text-neutral-400">Geen geplande activiteiten voor dit tijdsbestek.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-border bg-neutral-100 gap-px overflow-hidden rounded-xl">
          {filteredEvents.map((event) => {
            const isAttending = event.attendees?.includes(userId);
            const isTrip = event.event_type === "trip";
            const attendeesList = event.attendees || [];

            return (
              <div key={event.id} className="bg-container-bg p-5 flex flex-col justify-between space-y-4">
                
                {/* Bovenste Info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${isTrip ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-600"}`}>
                      {getDutchDayName(event.date)} • {event.date}
                    </span>
                    <button 
                      onClick={() => toggleAttendance(event)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-tight transition flex items-center gap-1 border ${isAttending ? "bg-red-50 border-red-100 text-red-600" : "bg-background border-border text-neutral-400 hover:text-neutral-600"}`}
                    >
                      <Heart size={10} fill={isAttending ? "currentColor" : "none"} />
                      {isAttending ? "Ik ga mee" : "Aanmelden"}
                    </button>
                  </div>
                  
                  <h3 className="text-base font-black tracking-tight text-foreground">{event.title}</h3>
                  
                  {event.time && (
                    <p className="text-[11px] font-bold text-neutral-400">
                      🕒 Tijd: {event.time} {event.end_time ? `tot ${formatEndDateTime(event.end_time)}` : ""}
                    </p>
                  )}
                  
                  {event.location_address && (
                    <div className="flex items-center gap-1 text-[11px] text-neutral-500 font-bold">
                      <MapPin size={11} className="text-neutral-400 shrink-0" />
                      <span className="truncate">{event.location_address}</span>
                    </div>
                  )}
                  
                  {event.dresscode && (
                    <p className="text-[10px] font-bold text-neutral-500 bg-background px-2 py-1 rounded-md inline-block border border-border/40">
                      ✨ <b>Dresscode:</b> {event.dresscode}
                    </p>
                  )}
                </div>

                {/* Live Deelnemers (FOMO) */}
                <div className="flex items-center gap-2 bg-background p-2 rounded-xl">
                  {attendeesList.length === 0 ? (
                    <span className="text-[9px] font-bold text-neutral-400 italic">Nog niemand aangemeld</span>
                  ) : (
                    <>
                      <div className="flex items-center -space-x-1.5 overflow-hidden">
                        {attendeesList.map((attId: string) => {
                          const member = groupProfiles[attId];
                          const fallbackName = attId === userId ? "Jij" : "Lid";
                          return (
                            <img 
                              key={attId}
                              src={member?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb"} 
                              className="w-6 h-6 rounded-full object-cover ring-2 ring-white" 
                              alt={member?.full_name || fallbackName} 
                              title={member?.full_name || fallbackName}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[10px] font-black text-neutral-500">
                        {attendeesList.length} mee
                      </span>
                    </>
                  )}
                </div>

                {/* Reis-specifiek: Route & Stops */}
                {isTrip && (event.start_location || event.end_location) && (
                  <div className="text-xs font-bold text-neutral-600 bg-background p-2 rounded-lg space-y-1">
                    <div className="flex items-center gap-1">
                      <Navigation size={10} className="text-amber-600" />
                      <span>{event.start_location || "Start"}</span>
                      <ArrowRight size={10} />
                      <span>{event.end_location || "Eind"}</span>
                    </div>
                    {event.intermediate_stops?.length > 0 && (
                      <div className="text-[9px] text-neutral-400 pl-4">
                        Route: {event.intermediate_stops.join(" ➔ ")}
                      </div>
                    )}
                  </div>
                )}

                {/* DYNAMISCHE MULTI-CLAIM MEENEEMLIJST */}
                <div className="space-y-2 border-t border-neutral-50 pt-3">
                  <h4 className="text-[9px] font-extrabold uppercase text-neutral-400 tracking-wider flex items-center">
                    <ShoppingBag size={10} className="mr-1" /> Wie neemt wat mee?
                  </h4>
                  
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                    {event.bring_list?.map((itemObj: any, index: number) => {
                      const claims = itemObj.claims || [];
                      const amIClaiming = claims.some((c: any) => c.user_id === userId);

                      return (
                        <div 
                          key={index}
                          onClick={() => claimItem(event, index)}
                          className={`flex flex-col p-2 rounded-xl border cursor-pointer transition ${amIClaiming ? "bg-neutral-950 text-white border-neutral-950" : "bg-container-bg text-neutral-700 hover:bg-background border-border"}`}
                        >
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span>{itemObj.item}</span>
                            <span className="text-[9px] opacity-65 bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600 font-extrabold">
                              {claims.length}x
                            </span>
                          </div>
                          {claims.length > 0 && (
                            <div className={`text-[9px] mt-0.5 font-bold flex flex-wrap gap-1 ${amIClaiming ? "text-neutral-300" : "text-neutral-400"}`}>
                              🙋‍♂️ {claims.map((c: any) => c.name).join(", ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <input 
                      type="text" 
                      placeholder="+ Voeg item toe aan de lijst..." 
                      value={newEventItem[event.id] || ""}
                      onChange={e => setNewEventItem({ ...newEventItem, [event.id]: e.target.value })}
                      className="flex-1 bg-background border border-border/60 rounded-lg px-2 py-1 text-[11px] outline-none font-bold"
                    />
                    <button onClick={() => addNewItemToExistingEvent(event.id)} className="px-2.5 bg-neutral-900 text-white text-xs rounded-lg font-bold">+</button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* CREATIE MODAL */}
      {showCreateSheet && (
        <div className="fixed inset-0 z-999 bg-black/20 backdrop-blur-xl flex items-end sm:items-center justify-center">
          <div className="bg-container-bg w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-xs font-black text-foreground">Nieuw event toevoegen</h2>
              <button onClick={() => setShowCreateSheet(false)} className="text-xs font-bold text-neutral-400"><X size={16} /></button>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold p-2.5 rounded-xl">
                ⚠️ {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 bg-neutral-100 p-1 rounded-xl">
              <button type="button" onClick={() => { setEventType("hangout"); setFormError(null); }} className={`py-1.5 rounded-lg text-xs font-bold transition ${eventType === "hangout" ? "bg-container-bg text-foreground shadow-3xs" : "text-neutral-500"}`}>🍻 Hangout</button>
              <button type="button" onClick={() => { setEventType("trip"); setFormError(null); }} className={`py-1.5 rounded-lg text-xs font-bold transition ${eventType === "trip" ? "bg-container-bg text-foreground shadow-3xs" : "text-neutral-500"}`}>✈️ Reis / Roadtrip</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setFormError(null);

              if (!title.trim() || !date || !activeGroupId) {
                setFormError("Vul alle verplichte basisvelden in.");
                return;
              }

              if (!locationAddress.trim()) {
                setFormError("Je bent verplicht een locatie/adres op te geven!");
                return;
              }
              
              const payload: any = {
                group_id: activeGroupId,
                title: title.trim(),
                date,
                event_type: eventType,
                location_address: locationAddress.trim(),
                bring_list: modalBringList.map(item => ({ item, claims: [] })),
                attendees: [userId], 
                dresscode: dresscode.trim() || null
              };

              if (eventType === "hangout") {
                payload.time = time || null;
                payload.end_time = hasEndTime && endTime ? endTime : null;
              } else {
                payload.end_date = endDate || null;
                payload.start_location = startLocation.trim() || null;
                payload.end_location = endLocation.trim() || null;
                payload.intermediate_stops = stops;
              }

              // Optimistic Add to cache
              const temporaryId = Math.random().toString();
              mutateEvents((old: any) => ({
                ...old,
                events: [...old.events, { id: temporaryId, ...payload }]
              }), false);

              setShowCreateSheet(false); setTitle(""); setDate(""); setTime(""); setEndTime(""); setHasEndTime(false); setLocationAddress(""); setEndDate(""); setStartLocation(""); setEndLocation(""); setStops([]); setDresscode(""); setModalBringList([]);

              const { error } = await supabase.from("events").insert(payload);
              if (error) {
                setFormError("Er ging iets mis bij het opslaan: " + error.message);
              }
              mutateEvents();
            }} className="space-y-3">
              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Naam van activiteit</label>
                <input type="text" placeholder={eventType === "hangout" ? "Barbecue, Thuisbieren, Clubs..." : "Roadtrip 2026..."} value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-background border border-border p-2.5 rounded-xl text-xs font-bold outline-none" />
              </div>

              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Locatie / Adres (Verplicht) *</label>
                <input type="text" placeholder="bv. Café De Klomp, Dorpsstraat 12 of Gent-Sint-Pieters..." value={locationAddress} onChange={e => setLocationAddress(e.target.value)} required className="w-full bg-background border border-border p-2.5 rounded-xl text-xs font-bold outline-none border-l-2 border-l-black" />
              </div>

              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Dresscode (Optioneel)</label>
                <input type="text" placeholder="bv. Casual chic, Festival, All black..." value={dresscode} onChange={e => setDresscode(e.target.value)} className="w-full bg-background border border-border p-2.5 rounded-xl text-xs font-bold outline-none" />
              </div>

              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Meeneemlijst vooraf opstellen</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Voeg item toe..." value={modalBringInput} onChange={e => setModalBringInput(e.target.value)} className="flex-1 bg-background border border-border p-2.5 rounded-xl text-xs font-bold outline-none" />
                  <button type="button" onClick={() => { if(modalBringInput.trim()){ setModalBringList([...modalBringList, modalBringInput.trim()]); setModalBringInput(""); } }} className="bg-btn-bg text-btn-text px-4 rounded-xl text-xs font-bold">+</button>
                </div>
                {modalBringList.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 max-h-24 overflow-y-auto">
                    {modalBringList.map((item, i) => (
                      <span key={i} className="bg-background text-neutral-800 text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1">
                        🎒 {item}
                        <button type="button" onClick={() => setModalBringList(modalBringList.filter((_, idx) => idx !== i))} className="text-neutral-400 hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">{eventType === "hangout" ? "Datum" : "Startdatum"}</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-background border border-border p-2.5 rounded-xl text-xs font-bold outline-none" />
                </div>
                
                {eventType === "hangout" ? (
                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Starttijd</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-background border border-border p-2.5 rounded-xl text-xs font-bold outline-none" />
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Einddatum</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="w-full bg-background border border-border p-2.5 rounded-xl text-xs font-bold outline-none" />
                  </div>
                )}
              </div>

              {eventType === "hangout" && (
                <div className="bg-background p-2.5 rounded-xl space-y-2 border border-border">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={hasEndTime} onChange={e => setHasEndTime(e.target.checked)} className="rounded border-neutral-300 text-foreground focus:ring-black accent-black" />
                    <span className="text-[11px] font-bold text-neutral-700">Heeft deze hangout een einduur/datum?</span>
                  </label>
                  
                  {hasEndTime && (
                    <div className="animate-in fade-in duration-200">
                      <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Einddatum & Uur</label>
                      <input 
                        type="datetime-local" 
                        value={endTime} 
                        onChange={e => setEndTime(e.target.value)} 
                        required={hasEndTime} 
                        className="w-full bg-container-bg border border-border p-2 rounded-lg text-xs font-bold outline-none" 
                      />
                    </div>
                  )}
                </div>
              )}

              {eventType === "trip" && (
                <div className="space-y-2 border-t border-neutral-50 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Vertreklocatie</label>
                      <input type="text" placeholder="Thuis..." value={startLocation} onChange={e => setStartLocation(e.target.value)} className="w-full bg-background border border-border p-2 rounded-xl text-xs font-bold outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Eindbestemming</label>
                      <input type="text" placeholder="Bestemming..." value={endLocation} onChange={e => setEndLocation(e.target.value)} className="w-full bg-background border border-border p-2 rounded-xl text-xs font-bold outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Tussenstop toevoegen</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="bv. Hotel of tankstation..." value={stopInput} onChange={e => setStopInput(e.target.value)} className="flex-1 bg-background border border-border p-2 rounded-xl text-xs font-bold outline-none" />
                      <button type="button" onClick={() => { if(stopInput.trim()){ setStops([...stops, stopInput.trim()]); setStopInput(""); } }} className="bg-neutral-100 px-3 rounded-xl text-xs font-bold">+</button>
                    </div>
                    {stops.length > 0 && (
                      <div className="text-[10px] text-neutral-500 mt-1 font-bold">
                        Route verloop: {stops.join(" ➔ ")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" className="w-full bg-btn-bg text-btn-text p-3 rounded-xl text-xs font-bold active:scale-98 transition mt-2">
                Event definitief opslaan 🚀
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}