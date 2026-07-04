"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

interface Member {
  id: string;
  full_name: string;
  avatar_url: string;
  visible: boolean;
}

interface BusyPeriod {
  id: string;
  profile_id: string;
  start_time: string;
  end_time: string;
  title: string;
}

interface EventItem {
  id: string;
  title: string;
  location: string;
  start_time: string;
  end_time: string;
  description: string; // Hierin slaan we de dresscode en bring list op
  created_by: string;
}

export default function EventsAndCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [userGroups, setUserGroups] = useState<any[]>([]);
  
  // Data states
  const [members, setMembers] = useState<Member[]>([]);
  const [busyPeriods, setBusyPeriods] = useState<BusyPeriod[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  // UI Toggles
  const [showBusyOverlay, setShowBusyOverlay] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "events" | "busy">("all");
  const [showEventSheet, setShowEventSheet] = useState(false);
  const [showBusySheet, setShowBusySheet] = useState(false);

  // Form States: Nieuw Event
  const [eventTitle, setEventTitle] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [dresscode, setDresscode] = useState("");
  const [hasBringList, setHasBringList] = useState(false);
  const [currentItemInput, setCurrentItemInput] = useState("");
  const [bringListItems, setBringListItems] = useState<string[]>([]);

  // Form States: Bezet Markeren
  const [busyTitle, setBusyTitle] = useState("");
  const [busyStart, setBusyStart] = useState("");
  const [busyEnd, setBusyEnd] = useState("");

  useEffect(() => {
    async function initCalendar() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      setCurrentUserId(userData.user.id);

      // Check of de gebruiker in minstens één groep zit
      const { data: membershipData } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", userData.user.id);

      setUserGroups(membershipData || []);

      if (!membershipData || membershipData.length === 0) {
        setLoading(false);
        return;
      }

      // Laad groepsleden
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url");

      if (profilesData) {
        setMembers(profilesData.map(p => ({
          id: p.id,
          full_name: p.full_name || "Groepslid",
          avatar_url: p.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${p.id}`,
          visible: true
        })));
      }

      // Laad busy periods
      const { data: busyData } = await supabase.from("availability_slots").select("*");
if (busyData) {
  setBusyPeriods(busyData.map((b: any) => ({
    id: b.id,
    profile_id: b.user_id, // Map user_id naar profile_id voor de UI component
    start_time: b.starts_at,
    end_time: b.ends_at,
    title: b.note || "Bezet"
  })));
}

      // Laad geplande events
      const { data: eventsData } = await supabase.from("events").select("*");
      if (eventsData) setEvents(eventsData);

      setLoading(false);
    }
    initCalendar();
  }, []);

  // Voeg item toe aan de bring list via de plus-knop
  const addBringItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItemInput.trim()) return;
    setBringListItems([...bringListItems, currentItemInput.trim()]);
    setCurrentItemInput("");
  };

  const removeBringItem = (index: number) => {
    setBringListItems(bringListItems.filter((_, i) => i !== index));
  };

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle || !eventStart || !eventEnd) return;

    const { error } = await supabase.from("events").insert({
      title: eventTitle,
      location: eventLocation,
      start_time: new Date(eventStart).toISOString(),
      end_time: new Date(eventEnd).toISOString(),
      description: JSON.stringify({
        dresscode,
        hasBringList,
        items: bringListItems
      }),
      created_by: currentUserId
    });

    if (error) {
      alert(error.message);
    } else {
      setShowEventSheet(false);
      window.location.reload();
    }
  }

  async function handleMarkBusy(e: React.FormEvent) {
    e.preventDefault();
    if (!busyStart || !busyEnd) return;

    const { error } = await supabase.from("availability_slots").insert({
      user_id: currentUserId,
      note: busyTitle || "Bezet",
      starts_at: new Date(busyStart).toISOString(),
      ends_at: new Date(busyEnd).toISOString(),
      status: "busy"
    });

    if (error) {
      alert(error.message);
    } else {
      setShowBusySheet(false);
      window.location.reload();
    }
  }

  if (loading) return <div className="p-6 text-sm text-neutral-400 font-medium">Agenda synchroniseren...</div>;

  // HIER IS DE DUIDELIJKE GEBRUIKERSMELDING IN PLAATS VAN DE RLS RECURSION ERROR
  if (userGroups.length === 0) {
    return (
      <div className="max-w-md mx-auto pt-16 text-center px-4">
        <div className="h-12 w-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-xl mb-4">🗓️</div>
        <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Geen actieve groep gevonden</h2>
        <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
          Je hebt toegang tot de agenda nodig. Ga naar de <strong>Groepen</strong> pagina om een nieuwe groep aan te maken of deel te nemen met een groepslink.
        </p>
      </div>
    );
  }

  // Filters toepassen op basis van actieve persoons-toggles
  const visibleUserIds = members.filter(m => m.visible).map(m => m.id);
  
  const displayBusy = showBusyOverlay 
    ? busyPeriods.filter(bp => visibleUserIds.includes(bp.profile_id))
    : [];

  // Combineer en sorteer alles chronologisch voor de Apple-lijstweergave
  const timelineItems = [
    ...events.map(e => ({ ...e, type: "event" as const, date: new Date(e.start_time) })),
    ...displayBusy.map(b => ({ ...b, type: "busy" as const, date: new Date(b.start_time) }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime())
   .filter(item => {
     if (activeTab === "events") return item.type === "event";
     if (activeTab === "busy") return item.type === "busy";
     return true;
   });

  return (
    <div className="space-y-8 px-2 md:px-0 pb-20">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">Agenda</h1>
          <p className="text-sm text-neutral-400 font-medium mt-0.5">Plannen en filteren met je vrienden.</p>
        </div>
        
        {/* Apple Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowBusySheet(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-semibold bg-neutral-100 text-neutral-800 transition active:scale-95"
          >
            Markeer Bezet
          </button>
          <button 
            onClick={() => setShowEventSheet(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-semibold bg-black text-white transition active:scale-95"
          >
            + Nieuwe Hangout
          </button>
        </div>
      </div>

      {/* CORE INTEGRATED WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* NATIVE PERSON FILTERS (Bovenaan op mobiel, links op desktop) */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Wie is er vrij?</span>
            <button 
              onClick={() => setShowBusyOverlay(!showBusyOverlay)} 
              className="text-xs font-semibold text-neutral-500 underline underline-offset-2"
            >
              {showBusyOverlay ? "Verberg bezet" : "Toon bezet"}
            </button>
          </div>
          
          <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => setMembers(prev => prev.map(m => m.id === member.id ? { ...m, visible: !m.visible } : m))}
                className={`flex items-center space-x-3 p-2.5 rounded-xl transition-all text-left flex-shrink-0 min-w-[140px] lg:w-full border ${
                  member.visible 
                    ? "bg-neutral-50 border-neutral-200/60 shadow-sm" 
                    : "bg-white border-transparent opacity-40"
                }`}
              >
                <img src={member.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover bg-neutral-200 flex-shrink-0" />
                <span className="text-xs font-semibold text-neutral-800 truncate">{member.full_name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* NATIVE AGENDA TIMELINE LISTVIEW */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Segmented Control (Apple-stijl tab-schakelaar) */}
          <div className="bg-neutral-100 p-1 rounded-xl flex max-w-sm">
            {(["all", "events", "busy"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                  activeTab === tab ? "bg-white text-black shadow-xs" : "text-neutral-500"
                }`}
              >
                {tab === "all" ? "Alles" : tab === "events" ? "Hangouts" : "Bezet"}
              </button>
            ))}
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            {timelineItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-400 font-medium bg-white rounded-2xl border border-neutral-100/40">
                Geen geplande momenten gevonden in deze selectie.
              </div>
            ) : (
              timelineItems.map((item: any) => {
                const isEvent = item.type === "event";
                const user = members.find(m => m.id === (isEvent ? item.created_by : item.profile_id));
                
                // Parse description if it contains JSON for dresscode & bring list
                let details = { dresscode: "", hasBringList: false, items: [] };
                if (isEvent && item.description) {
                  try { details = JSON.parse(item.description); } catch (e) {}
                }

                return (
                  <div 
                    key={item.id} 
                    className={`p-4 rounded-2xl transition-all border ${
                      isEvent 
                        ? "bg-black text-white border-transparent" 
                        : "bg-white border-neutral-100/80 text-neutral-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md ${
                            isEvent ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600"
                          }`}>
                            {isEvent ? "✨ Hangout" : "🔒 Bezet"}
                          </span>
                          {item.location && (
                            <span className={`text-xs truncate max-w-[150px] ${isEvent ? "text-neutral-300" : "text-neutral-400"}`}>
                              📍 {item.location}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold truncate">{item.title}</h3>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs font-bold ${isEvent ? "text-white" : "text-neutral-900"}`}>
                          {new Date(item.start_time).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className={`text-[11px] ${isEvent ? "text-neutral-400" : "text-neutral-400"}`}>
                          {new Date(item.start_time).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Social creator footer element */}
                    <div className="mt-4 pt-3 border-t border-neutral-100/10 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <img src={user?.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
                        <span className={isEvent ? "text-neutral-300" : "text-neutral-500"}>
                          {isEvent ? `Georganiseerd door ${user?.full_name}` : user?.full_name}
                        </span>
                      </div>
                    </div>

                    {/* Render bring list & dresscode directly inside if active */}
                    {isEvent && (details.dresscode || details.hasBringList) && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs text-neutral-200">
                        {details.dresscode && <p><strong>Dresscode:</strong> {details.dresscode}</p>}
                        {details.hasBringList && details.items.length > 0 && (
                          <div>
                            <p className="font-bold mb-1">Meeneemlijst:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {details.items.map((it: string, idx: number) => (
                                <span key={idx} className="bg-white/10 px-2 py-0.5 rounded-md text-[11px]">{it}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>

      {/* ================= NATIVE APPLE SHEETS (MODALS) ================= */}

      {/* SHEET A: NIEUW EVENT AANMAKEN */}
      {showEventSheet && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 animate-slide-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h2 className="text-base font-bold">Nieuwe Hangout</h2>
              <button onClick={() => setShowEventSheet(false)} className="text-sm font-semibold text-neutral-400 hover:text-black">Annuleer</button>
            </div>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <input type="text" placeholder="Titel van de hangout" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required className="w-full bg-neutral-50 p-3.5 rounded-xl text-sm outline-none" />
              <input type="text" placeholder="Locatie / Adres" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} className="w-full bg-neutral-50 p-3.5 rounded-xl text-sm outline-none" />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 px-1">Start</label>
                  <input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} required className="w-full bg-neutral-50 p-3 rounded-xl text-xs outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 px-1">Einde</label>
                  <input type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} required className="w-full bg-neutral-50 p-3 rounded-xl text-xs outline-none" />
                </div>
              </div>

              <input type="text" placeholder="Dresscode (bijv. Casual Chique)" value={dresscode} onChange={(e) => setDresscode(e.target.value)} className="w-full bg-neutral-50 p-3.5 rounded-xl text-sm outline-none" />

              <div className="flex items-center justify-between p-1 bg-neutral-50 rounded-xl px-3 py-2.5">
                <span className="text-xs font-semibold text-neutral-600">Activeer Meeneemlijst</span>
                <input type="checkbox" checked={hasBringList} onChange={(e) => setHasBringList(e.target.checked)} className="rounded text-black focus:ring-0 w-4 h-4" />
              </div>

              {/* IPHONE PLUS-BUTTON JION LIST INPUT PATTERN */}
              {hasBringList && (
                <div className="space-y-2 animate-fadeIn">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Voeg item toe (bijv. Chips)" 
                      value={currentItemInput} 
                      onChange={(e) => setCurrentItemInput(e.target.value)} 
                      className="flex-1 bg-neutral-50 p-3 rounded-xl text-sm outline-none" 
                    />
                    <button 
                      onClick={addBringItem}
                      className="bg-neutral-900 text-white font-bold px-4 rounded-xl text-sm hover:bg-black"
                    >
                      +
                    </button>
                  </div>
                  
                  {bringListItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-50 rounded-xl">
                      {bringListItems.map((item, index) => (
                        <span key={index} className="bg-white px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs">
                          {item}
                          <button type="button" onClick={() => removeBringItem(index)} className="text-neutral-400 hover:text-red-500 font-bold">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition">
                Hangout Toevoegen
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SHEET B: BEZET MARKEREN */}
      {showBusySheet && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h2 className="text-base font-bold">Tijd Blokkeren</h2>
              <button onClick={() => setShowBusySheet(false)} className="text-sm font-semibold text-neutral-400 hover:text-black">Annuleer</button>
            </div>
            
            <form onSubmit={handleMarkBusy} className="space-y-4">
              <input type="text" placeholder="Reden (bijv. Werk, Sporten)" value={busyTitle} onChange={(e) => setBusyTitle(e.target.value)} required className="w-full bg-neutral-50 p-3.5 rounded-xl text-sm outline-none" />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 px-1">Van</label>
                  <input type="datetime-local" value={busyStart} onChange={(e) => setBusyStart(e.target.value)} required className="w-full bg-neutral-50 p-3 rounded-xl text-xs outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 px-1">Tot</label>
                  <input type="datetime-local" value={busyEnd} onChange={(e) => setBusyEnd(e.target.value)} required className="w-full bg-neutral-50 p-3 rounded-xl text-xs outline-none" />
                </div>
              </div>

              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-sm font-semibold shadow-sm">
                Blokkeer deze periode
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}