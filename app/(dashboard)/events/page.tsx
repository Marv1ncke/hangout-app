/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Calendar, MapPin, Shirt, ShoppingBag, Plus, Check, Heart } from "lucide-react";

export default function EventsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [events, setEvents] = useState<any[]>([]);
  
  // Sheet State
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  
  // Form input states
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [dresscode, setDresscode] = useState("");
  const [bringInput, setBringInput] = useState("");
  const [bringList, setBringList] = useState<string[]>([]);

  // Extra item toevoegen aan bestaand event
  const [newEventItem, setNewEventItem] = useState<{ [eventId: string]: string }>({});

  async function loadEvents() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;
    setUserId(userData.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("selected_group_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.selected_group_id) {
      setLoading(false);
      return;
    }
    setActiveGroupId(profile.selected_group_id);

    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .eq("group_id", profile.selected_group_id)
      .order("date", { ascending: true });

    setEvents(eventsData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
    window.addEventListener("groupChanged", loadEvents);
    return () => window.removeEventListener("groupChanged", loadEvents);
  }, []);

  const addBringItemToForm = () => {
    if (!bringInput.trim()) return;
    setBringList([...bringList, bringInput.trim()]);
    setBringInput("");
  };

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !activeGroupId) return;

    // Converteer meeneemlijst array naar database JSON structuur
    const itemsJson = bringList.map(item => ({
      item: item,
      claimed_by: null,
      claimed_name: null
    }));

    const { error } = await supabase.from("events").insert({
      group_id: activeGroupId,
      title: title.trim(),
      date,
      time: time || null,
      location: location.trim() || null,
      dresscode: dresscode.trim() || null,
      bring_list: itemsJson,
      attendees: [userId] // De maker is direct aanwezig! FOMO starter packet.
    });

    if (!error) {
      setShowCreateSheet(false);
      setTitle(""); setDate(""); setTime(""); setLocation(""); setDresscode(""); setBringList([]);
      loadEvents();
    }
  }

  async function toggleAttendance(event: any) {
    const currentAttendees = event.attendees || [];
    let updated: string[];

    if (currentAttendees.includes(userId)) {
      updated = currentAttendees.filter((id: string) => id !== userId);
    } else {
      updated = [...currentAttendees, userId];
    }

    await supabase.from("events").update({ attendees: updated }).eq("id", event.id);
    loadEvents();
  }

  async function claimItem(event: any, itemIndex: number) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
    const updatedList = [...event.bring_list];
    
    if (updatedList[itemIndex].claimed_by === userId) {
      // Unclaim
      updatedList[itemIndex].claimed_by = null;
      updatedList[itemIndex].claimed_name = null;
    } else {
      // Claim
      updatedList[itemIndex].claimed_by = userId;
      updatedList[itemIndex].claimed_name = profile?.full_name || "Lid";
    }

    await supabase.from("events").update({ bring_list: updatedList }).eq("id", event.id);
    loadEvents();
  }

  async function addNewItemToExistingEvent(eventId: string) {
    const text = newEventItem[eventId];
    if (!text || !text.trim()) return;

    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const updatedList = [...(event.bring_list || []), { item: text.trim(), claimed_by: null, claimed_name: null }];
    
    await supabase.from("events").update({ bring_list: updatedList }).eq("id", eventId);
    setNewEventItem({ ...newEventItem, [eventId]: "" });
    loadEvents();
  }

  if (loading) return <div className="text-sm font-medium text-neutral-400">Hangouts inladen...</div>;

  if (!activeGroupId) {
    return (
      <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-neutral-100">
        <p className="text-sm font-bold text-neutral-500">Selecteer of maak eerst een groep aan via het tabblad Groepen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none animate-in fade-in">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Hangouts</h1>
          <p className="text-xs font-bold text-neutral-400 mt-0.5">Plan momenten, drop dresscodes en verdeel snacks.</p>
        </div>
        <div className="flex gap-1.5">
          <button 
            onClick={() => router.push("/availability")} 
            className="px-3 py-2 bg-neutral-100 text-neutral-800 text-xs font-bold rounded-xl active:scale-95 transition"
          >
            Bezetting Vastleggen
          </button>
          <button 
            onClick={() => setShowCreateSheet(true)} 
            className="px-3 py-2 bg-black text-white text-xs font-bold rounded-xl active:scale-95 transition"
          >
            + Hangout
          </button>
        </div>
      </div>

      {/* EVENTS TIMELINE GRID */}
      {events.length === 0 ? (
        <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-neutral-100/60">
          <p className="text-sm font-bold text-neutral-400">Er staan nog geen Hangouts gepland voor deze groep.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const isAttending = event.attendees?.includes(userId);
            return (
              <div key={event.id} className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-3xs space-y-4">
                
                {/* Event Core Info */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-black tracking-tight text-neutral-900">{event.title}</h3>
                    <p className="text-xs font-bold text-neutral-400 flex items-center mt-1">
                      <Calendar size={12} className="mr-1" /> {event.date} {event.time ? `om ${event.time}` : ""}
                    </p>
                  </div>

                  {/* Like/FOMO Social Attending Button */}
                  <button 
                    onClick={() => toggleAttendance(event)}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                      isAttending ? "bg-red-50 text-red-500" : "bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <Heart size={13} fill={isAttending ? "currentColor" : "none"} />
                    <span>{isAttending ? "Aanwezig" : "Gaan"}</span>
                  </button>
                </div>

                {/* Optional Metadata Grid */}
                {(event.location || event.dresscode) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-neutral-50/50 p-2.5 rounded-xl text-xs">
                    {event.location && (
                      <div className="flex items-center space-x-1.5 font-medium text-neutral-700">
                        <MapPin size={13} className="text-neutral-400" />
                        <span className="truncate">📍 {event.location}</span>
                      </div>
                    )}
                    {event.dresscode && (
                      <div className="flex items-center space-x-1.5 font-medium text-neutral-700">
                        <Shirt size={13} className="text-neutral-400" />
                        <span className="truncate">👗 {event.dresscode}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Social Post Style Attendance Count */}
                {event.attendees?.length > 0 && (
                  <div className="text-[11px] font-bold text-neutral-500 flex items-center space-x-1 px-1">
                    <span className="flex -space-x-1.5 mr-1">
                      {event.attendees.slice(0, 3).map((id: string, i: number) => (
                        <div key={i} className="h-4 w-4 rounded-full bg-neutral-200 border border-white flex items-center justify-center text-[6px] font-bold">👤</div>
                      ))}
                    </span>
                    <span>Geliked door {event.attendees.length} {event.attendees.length === 1 ? "persoon" : "mensen"}</span>
                  </div>
                )}

                {/* Dynamic Bring List Area */}
                <div className="border-t border-neutral-50 pt-3 space-y-2">
                  <h4 className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider flex items-center">
                    <ShoppingBag size={11} className="mr-1" /> Wie brengt wat mee?
                  </h4>

                  <div className="space-y-1.5">
                    {event.bring_list?.map((itemObj: any, index: number) => {
                      const isClaimedByMe = itemObj.claimed_by === userId;
                      return (
                        <div 
                          key={index} 
                          onClick={() => claimItem(event, index)}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            isClaimedByMe 
                              ? "bg-neutral-900 border-neutral-900 text-white" 
                              : itemObj.claimed_by 
                              ? "bg-neutral-50 border-neutral-100 text-neutral-400 line-through" 
                              : "bg-white border-neutral-100 text-neutral-700 hover:border-neutral-200"
                          }`}
                        >
                          <span>{itemObj.item}</span>
                          <span className={`text-[10px] ${isClaimedByMe ? "text-neutral-300" : "text-neutral-400"}`}>
                            {itemObj.claimed_by ? `🙋‍♂️ ${itemObj.claimed_name}` : "Claim item"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Leden kunnen zelf items droppen in de lijst */}
                  <div className="flex gap-2 pt-1.5" onClick={e => e.stopPropagation()}>
                    <input 
                      type="text" 
                      placeholder="Voeg iets toe aan de lijst..." 
                      value={newEventItem[event.id] || ""}
                      onChange={e => setNewEventItem({ ...newEventItem, [event.id]: e.target.value })}
                      className="flex-1 bg-neutral-50 border border-neutral-200/60 rounded-xl px-3 py-2 text-xs outline-none"
                    />
                    <button 
                      onClick={() => addNewItemToExistingEvent(event.id)}
                      className="p-2 bg-neutral-100 rounded-xl text-neutral-800 active:scale-95 transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* DYNAMIC INSTAGRAM CREATE EVENT SHEET */}
      {showCreateSheet && (
        <div className="fixed inset-0 z-[999] bg-neutral-900/20 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-black text-neutral-900">Nieuwe Hangout</h2>
              <button onClick={() => setShowCreateSheet(false)} className="text-xs font-bold text-neutral-400">Sluiten</button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Titel *</label>
                <input type="text" placeholder="bv. BBQ, Escaperoom, Café avond" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-100 p-2.5 rounded-xl text-xs outline-none text-neutral-900 font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Datum *</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-100 p-2.5 rounded-xl text-xs outline-none text-neutral-900 font-bold" />
                </div>
                <div>
                  <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Tijdstip</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-neutral-50 border border-neutral-100 p-2.5 rounded-xl text-xs outline-none text-neutral-900 font-bold" />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Locatie (Optioneel)</label>
                <input type="text" placeholder="Bij Thibeau, Gent, ..." value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-neutral-50 border border-neutral-100 p-2.5 rounded-xl text-xs outline-none text-neutral-900 font-medium" />
              </div>

              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Dresscode (Optioneel)</label>
                <input type="text" placeholder="Casual, All Black, Pool party" value={dresscode} onChange={e => setDresscode(e.target.value)} className="w-full bg-neutral-50 border border-neutral-100 p-2.5 rounded-xl text-xs outline-none text-neutral-900 font-medium" />
              </div>

              {/* Bring list initialization block */}
              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Meeneemlijst initialiseren</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="bv. Chips, Stella 6-pack, Vlees" value={bringInput} onChange={e => setBringInput(e.target.value)} className="flex-1 bg-neutral-50 border border-neutral-100 p-2.5 rounded-xl text-xs outline-none" />
                  <button type="button" onClick={addBringItemToForm} className="bg-neutral-100 px-3 rounded-xl text-xs font-bold active:scale-95 transition">Voeg toe</button>
                </div>
                {bringList.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {bringList.map((item, idx) => (
                      <span key={idx} className="bg-neutral-50 text-neutral-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-neutral-100">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" className="w-full bg-black text-white p-3 rounded-xl text-xs font-bold cursor-pointer active:scale-98 transition pt-3 mt-4">
                Hangout Drop 🚀
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}