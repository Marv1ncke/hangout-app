/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import React, { useState, useEffect, useRef } from "react";
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
  description: string;
  created_by: string;
  group_id: string;
}

interface GroupOption {
  id: string;
  name: string;
}

export default function EventsAndCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Groepen & Actieve groep status
  const [userGroups, setUserGroups] = useState<GroupOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  
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

  const isMounted = useRef(true);

  async function loadCalendarAndGroups(targetGroupId?: string) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user || !isMounted.current) return;
      const uid = userData.user.id;
      setCurrentUserId(uid);

      // 1. Haal het actieve profiel op om de geselecteerde groep te bekijken
      const { data: profile } = await supabase
        .from("profiles")
        .select("selected_group_id")
        .eq("id", uid)
        .maybeSingle();

      // 2. Haal alle groepen op waar de gebruiker actief lid van is (Gecorrigeerd naar user_id!)
      const { data: membershipData } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", uid)
        .eq("status", "active");

      if (!membershipData || membershipData.length === 0) {
        if (isMounted.current) {
          setUserGroups([]);
          setSelectedGroupId(null);
          setLoading(false);
        }
        return;
      }

      // Haal de namen van deze groepen op
      const groupIds = membershipData.map(m => m.group_id);
      const { data: groupsDetails } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", groupIds);

      if (groupsDetails && isMounted.current) {
        setUserGroups(groupsDetails);

        // Bepaal welke groep we inladen
        let activeGroupId = targetGroupId || profile?.selected_group_id;
        if (!activeGroupId || !groupIds.includes(activeGroupId)) {
          activeGroupId = groupsDetails[0].id;
          // Sla direct op als fallback
          await supabase.from("profiles").update({ selected_group_id: activeGroupId }).eq("id", uid);
        }
        setSelectedGroupId(activeGroupId);

        // 3. Haal alle actieve leden op van DEZE SPECIFIEKE groep
        const { data: groupMembers } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", activeGroupId)
          .eq("status", "active");

        if (groupMembers) {
          const memberIds = groupMembers.map(m => m.user_id);
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", memberIds);

          if (profilesData && isMounted.current) {
            setMembers(profilesData.map(p => ({
              id: p.id,
              full_name: p.full_name || "Groepslid",
              avatar_url: p.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${p.id}`,
              visible: true
            })));
          }
        }

        // 4. Laad busy periods van groepsleden voor deze groep
        const { data: busyData } = await supabase
          .from("availability_slots")
          .select("*")
          .eq("group_id", activeGroupId);

        if (busyData && isMounted.current) {
          setBusyPeriods(busyData.map((b: any) => ({
            id: b.id,
            profile_id: b.user_id,
            start_time: b.starts_at,
            end_time: b.ends_at,
            title: b.note || "Bezet"
          })));
        }

        // 5. Laad geplande events voor deze specifieke groep
        const { data: eventsData } = await supabase
          .from("events")
          .select("*")
          .eq("group_id", activeGroupId);
        
        if (eventsData && isMounted.current) {
          setEvents(eventsData);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    isMounted.current = true;
    loadCalendarAndGroups();
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleGroupChange(newGroupId: string) {
    setLoading(true);
    setSelectedGroupId(newGroupId);
    await supabase.from("profiles").update({ selected_group_id: newGroupId }).eq("id", currentUserId);
    await loadCalendarAndGroups(newGroupId);
  }

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
    if (!eventTitle || !eventStart || !eventEnd || !selectedGroupId) return;

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
      created_by: currentUserId,
      group_id: selectedGroupId
    });

    if (error) {
      alert(error.message);
    } else {
      setShowEventSheet(false);
      setLoading(true);
      await loadCalendarAndGroups(selectedGroupId);
    }
  }

  async function handleMarkBusy(e: React.FormEvent) {
    e.preventDefault();
    if (!busyStart || !busyEnd || !selectedGroupId) return;

    const { error } = await supabase.from("availability_slots").insert({
      user_id: currentUserId,
      group_id: selectedGroupId,
      note: busyTitle || "Bezet",
      starts_at: new Date(busyStart).toISOString(),
      ends_at: new Date(busyEnd).toISOString(),
      status: "busy"
    });

    if (error) {
      alert(error.message);
    } else {
      setShowBusySheet(false);
      setLoading(true);
      await loadCalendarAndGroups(selectedGroupId);
    }
  }

  if (loading) return <div className="p-6 text-sm text-neutral-400 font-medium">Agenda synchroniseren...</div>;

  if (userGroups.length === 0) {
    return (
      <div className="max-w-md mx-auto pt-16 text-center px-4 animate-fade-in">
        <div className="h-12 w-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-xl mb-4">🗓️</div>
        <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Geen actieve groep gevonden</h2>
        <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
          Je hebt toegang tot de agenda nodig. Ga naar de <strong>Groepen</strong> pagina om een nieuwe groep aan te maken of deel te nemen met een groepslink.
        </p>
      </div>
    );
  }

  const visibleUserIds = members.filter(m => m.visible).map(m => m.id);
  const displayBusy = showBusyOverlay ? busyPeriods.filter(bp => visibleUserIds.includes(bp.profile_id)) : [];

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
    <div className="space-y-8 px-2 md:px-0 pb-20 page-transition-wrapper">
      
      {/* HEADER SECTION WITH INTEGRATED APPLE GROUP SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">Agenda</h1>
          <p className="text-sm text-neutral-400 font-medium">Plannen en filteren met je vrienden.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* THE NATIVE APPLE DROP DOWN SWITCHER */}
          {userGroups.length > 0 && selectedGroupId && (
            <div className="flex items-center space-x-2 bg-neutral-50 p-1.5 rounded-xl border border-neutral-100/60 shrink-0 shadow-3xs">
              <span className="text-[10px] font-bold text-neutral-400 uppercase pl-2 tracking-wider">Groep:</span>
              <select 
                value={selectedGroupId} 
                onChange={(e) => handleGroupChange(e.target.value)}
                className="bg-white text-xs font-bold text-neutral-800 px-3 py-1.5 rounded-lg border-none outline-none shadow-3xs cursor-pointer pr-8 appearance-none relative bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23444%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_solid] bg-[right_10px_center] bg-no-repeat"
              >
                {userGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBusySheet(true)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-neutral-100 text-neutral-800 transition active:scale-95 cursor-pointer">Markeer Bezet</button>
            <button onClick={() => setShowEventSheet(true)} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-black text-white transition active:scale-95 cursor-pointer">+ Nieuwe Hangout</button>
          </div>
        </div>
      </div>

      {/* CORE INTEGRATED WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* NATIVE PERSON FILTERS */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Wie is er vrij?</span>
            <button onClick={() => setShowBusyOverlay(!showBusyOverlay)} className="text-xs font-bold text-neutral-500 underline underline-offset-2 cursor-pointer">
              {showBusyOverlay ? "Verberg bezet" : "Toon bezet"}
            </button>
          </div>
          
          <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => setMembers(prev => prev.map(m => m.id === member.id ? { ...m, visible: !m.visible } : m))}
                className={`flex items-center space-x-3 p-2.5 rounded-xl transition-all text-left flex-shrink-0 min-w-[140px] lg:w-full border cursor-pointer ${
                  member.visible ? "bg-neutral-50 border-neutral-200/60 shadow-xs" : "bg-white border-transparent opacity-40"
                }`}
              >
                <img src={member.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover bg-neutral-200 flex-shrink-0" />
                <span className="text-xs font-bold text-neutral-800 truncate">{member.full_name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* NATIVE AGENDA TIMELINE LISTVIEW */}
        <div className="lg:col-span-3 space-y-4">
          
          <div className="bg-neutral-100 p-1 rounded-xl flex max-w-sm">
            {(["all", "events", "busy"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer ${
                  activeTab === tab ? "bg-white text-black shadow-xs" : "text-neutral-500"
                }`}
              >
                {tab === "all" ? "Alles" : tab === "events" ? "Hangouts" : "Bezet"}
              </button>
            ))}
          </div>

          {/* Timeline Elements */}
          <div className="space-y-2">
            {timelineItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-400 font-medium bg-white rounded-2xl border border-neutral-100/40">
                Geen geplande momenten gevonden voor deze groep.
              </div>
            ) : (
              timelineItems.map((item: any) => {
                const isEvent = item.type === "event";
                const user = members.find(m => m.id === (isEvent ? item.created_by : item.profile_id));
                
                let details = { dresscode: "", hasBringList: false, items: [] };
                if (isEvent && item.description) {
                  try { details = JSON.parse(item.description); } catch (e) {}
                }

                return (
                  <div 
                    key={item.id} 
                    className={`p-4 rounded-2xl transition-all border ${
                      isEvent ? "bg-black text-white border-transparent shadow-xs" : "bg-white border-neutral-100/80 text-neutral-900 shadow-3xs"
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
                        <h3 className="text-base font-black tracking-tight">{item.title}</h3>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs font-bold ${isEvent ? "text-white" : "text-neutral-900"}`}>
                          {new Date(item.start_time).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {new Date(item.start_time).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100/10 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <img src={user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${isEvent ? item.created_by : item.profile_id}`} className="w-5 h-5 rounded-full object-cover bg-neutral-100" alt="" />
                        <span className={isEvent ? "text-neutral-300 font-medium" : "text-neutral-500 font-medium"}>
                          {isEvent ? `Georganiseerd door ${user?.full_name || "Groepslid"}` : user?.full_name || "Groepslid"}
                        </span>
                      </div>
                    </div>

                    {isEvent && (details.dresscode || details.hasBringList) && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs text-neutral-200">
                        {details.dresscode && <p><strong className="font-bold text-white">Dresscode:</strong> {details.dresscode}</p>}
                        {details.hasBringList && details.items.length > 0 && (
                          <div>
                            <p className="font-bold text-white mb-1">Meeneemlijst:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {details.items.map((it: string, idx: number) => (
                                <span key={idx} className="bg-white/10 px-2 py-0.5 rounded-md text-[11px] font-medium">{it}</span>
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

      {/* ================= MODAL SHEETS ================= */}

      {/* SHEET A: NIEUW EVENT */}
      {showEventSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl animate-sheet-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h2 className="text-sm font-bold text-neutral-900">Nieuwe Hangout</h2>
              <button onClick={() => setShowEventSheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <input type="text" placeholder="Titel van de hangout" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required className="w-full bg-neutral-50 p-3.5 rounded-xl text-xs font-medium text-neutral-900 outline-none" />
              <input type="text" placeholder="Locatie / Adres" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} className="w-full bg-neutral-50 p-3.5 rounded-xl text-xs font-medium text-neutral-900 outline-none" />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 px-1">Start</label>
                  <input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} required className="w-full bg-neutral-50 p-3 rounded-xl text-xs font-bold text-neutral-900 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 px-1">Einde</label>
                  <input type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} required className="w-full bg-neutral-50 p-3 rounded-xl text-xs font-bold text-neutral-900 outline-none" />
                </div>
              </div>

              <input type="text" placeholder="Dresscode (bijv. Casual Chique)" value={dresscode} onChange={(e) => setDresscode(e.target.value)} className="w-full bg-neutral-50 p-3.5 rounded-xl text-xs font-medium text-neutral-900 outline-none" />

              <div className="flex items-center justify-between p-1 bg-neutral-50 rounded-xl px-3 py-2.5">
                <span className="text-xs font-bold text-neutral-600">Activeer Meeneemlijst</span>
                <input type="checkbox" checked={hasBringList} onChange={(e) => setHasBringList(e.target.checked)} className="rounded text-black focus:ring-0 w-4 h-4 cursor-pointer" />
              </div>

              {hasBringList && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Voeg item toe (bijv. Chips)" value={currentItemInput} onChange={(e) => setCurrentItemInput(e.target.value)} className="flex-1 bg-neutral-50 p-3 rounded-xl text-xs font-medium text-neutral-900 outline-none" />
                    <button onClick={addBringItem} className="bg-black text-white font-bold px-4 rounded-xl text-xs cursor-pointer">+</button>
                  </div>
                  
                  {bringListItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-50 rounded-xl">
                      {bringListItems.map((item, index) => (
                        <span key={index} className="bg-white px-2.5 py-1 rounded-lg text-xs font-bold text-neutral-800 flex items-center gap-1.5 shadow-3xs">
                          {item}
                          <button type="button" onClick={() => removeBringItem(index)} className="text-neutral-400 hover:text-red-500 font-bold cursor-pointer">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-xs font-semibold shadow-sm cursor-pointer">Hangout Toevoegen</button>
            </form>
          </div>
        </div>
      )}

      {/* SHEET B: BEZET MARKEREN */}
      {showBusySheet && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl animate-sheet-in">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h2 className="text-sm font-bold text-neutral-900">Tijd Blokkeren</h2>
              <button onClick={() => setShowBusySheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            
            <form onSubmit={handleMarkBusy} className="space-y-4">
              <input type="text" placeholder="Reden (bijv. Werk, Sporten)" value={busyTitle} onChange={(e) => setBusyTitle(e.target.value)} required className="w-full bg-neutral-50 p-3.5 rounded-xl text-xs font-medium text-neutral-900 outline-none" />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 px-1">Van</label>
                  <input type="datetime-local" value={busyStart} onChange={(e) => setBusyStart(e.target.value)} required className="w-full bg-neutral-50 p-3 rounded-xl text-xs font-bold text-neutral-900 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-400 px-1">Tot</label>
                  <input type="datetime-local" value={busyEnd} onChange={(e) => setBusyEnd(e.target.value)} required className="w-full bg-neutral-50 p-3 rounded-xl text-xs font-bold text-neutral-900 outline-none" />
                </div>
              </div>

              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-xs font-semibold shadow-sm cursor-pointer">Blokkeer deze periode</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}