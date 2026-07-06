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

export default function AvailabilityPage() {
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [busyPeriods, setBusyPeriods] = useState<BusyPeriod[]>([]);
  
  // Toggle voor de hele 'Busy View' overlay
  const [showAllBusy, setShowAllBusy] = useState(true);

  // States voor het aanmaken van een nieuw Event (Apple-stijl sheet)
  const [eventTitle, setEventTitle] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dresscode, setDresscode] = useState("");
  const [hasBringList, setHasBringList] = useState(false);
  const [bringItems, setBringItems] = useState("");

  // States voor "Mark Yourself Busy"
  const [busyTitle, setBusyTitle] = useState("");
  const [busyStart, setBusyStart] = useState("");
  const [busyEnd, setBusyEnd] = useState("");

  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      setCurrentUserId(userData.user.id);

      // 1. Haal alle profielen op (vrienden/groepsleden)
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url");

      if (profilesData) {
        setMembers(profilesData.map(p => ({
          id: p.id,
          full_name: p.full_name || "Anoniem",
          avatar_url: p.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${p.id}`,
          visible: true
        })));
      }

      // 2. Haal busy periods op
      const { data: busyData } = await supabase
        .from("availability")
        .select("id, profile_id, start_time, end_time, title");
      
      if (busyData) {
        setBusyPeriods(busyData);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const toggleMemberVisibility = (id: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, visible: !m.visible } : m));
  };

  async function handleMarkBusy(e: React.FormEvent) {
    e.preventDefault();
    if (!busyStart || !busyEnd) return;

    const { error } = await supabase.from("availability").insert({
      profile_id: currentUserId,
      title: busyTitle || "Bezet",
      start_time: new Date(busyStart).toISOString(),
      end_time: new Date(busyEnd).toISOString()
    });

    if (error) {
      alert(error.message);
    } else {
      window.location.reload();
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventTitle || !startTime || !endTime) return;

    const { error } = await supabase.from("events").insert({
      title: eventTitle,
      location: eventLocation,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      description: JSON.stringify({
        dresscode,
        hasBringList,
        items: bringItems.split(",").map(i => i.trim()).filter(Boolean)
      }),
      created_by: currentUserId
    });

    if (error) {
      alert(error.message);
    } else {
      alert(" Event succesvol ingepland!");
      setEventTitle("");
      setEventLocation("");
      setStartTime("");
      setEndTime("");
      setDresscode("");
      setHasBringList(false);
      setBringItems("");
    }
  }

  // Filter de drukke periodes op basis van actieve toggles
  const activeVisibleUserIds = members.filter(m => m.visible).map(m => m.id);
  const filteredBusyPeriods = showAllBusy 
    ? busyPeriods.filter(bp => activeVisibleUserIds.includes(bp.profile_id))
    : [];

  if (loading) return <div className="text-sm text-neutral-400">Laden...</div>;

  return (
    <div className="space-y-10">
      
      {/* 1. TOP BAR: Apple Minimalist Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Beschikbaarheid & Planning</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Zie wanneer je vrienden bezet zijn en plan direct een hangout.</p>
        </div>
        
        {/* Master Toggle voor de hele view */}
        <button
          onClick={() => setShowAllBusy(!showAllBusy)}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
            showAllBusy ? "bg-btn-bg text-btn-text" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {showAllBusy ? "Verberg Bezette Tijden" : "Toon Bezette Tijden"}
        </button>
      </div>

      {/* 2. CORE INTERFACE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* SIDEBAR: Vrienden Toggles (Apple-stijl contactenlijst) */}
        <div className="lg:col-span-1 bg-background/60 p-4 rounded-2xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">Groepsleden</h3>
          <div className="space-y-1">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => toggleMemberVisibility(member.id)}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-neutral-100/80 transition-all text-left group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover bg-neutral-200" />
                  <span className="text-sm font-medium truncate text-neutral-800">{member.full_name}</span>
                </div>
                {/* Native iOS-achtige status indicator */}
                <div className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-200 ${member.visible ? 'bg-green-500' : 'bg-neutral-300'}`}>
                  <div className={`bg-container-bg w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${member.visible ? 'translate-x-3' : 'translate-x-0'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* AGENDA VIEW & ACTIONS */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* THE CALENDAR BLOCK */}
          <div className="bg-container-bg rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-background/40 flex justify-between items-center">
              <span className="text-sm font-semibold tracking-tight">Actieve Tijdsblokken op Agenda</span>
              <span className="text-xs text-neutral-400">{filteredBusyPeriods.length} actieve blokken</span>
            </div>
            
            {filteredBusyPeriods.length === 0 ? (
              <div className="p-10 text-center text-sm text-neutral-400">
                Geen bezette periodes zichtbaar op dit moment. Iedereen is vrij!
              </div>
            ) : (
              <div className="divide-y divide-neutral-50 max-h-80 overflow-y-auto">
                {filteredBusyPeriods.map((bp) => {
                  const user = members.find(m => m.id === bp.profile_id);
                  return (
                    <div key={bp.id} className="p-4 flex items-center justify-between gap-4 hover:bg-background/50 transition-colors">
                      <div className="flex items-center space-x-3 min-w-0">
                        <img src={user?.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{bp.title}</p>
                          <p className="text-xs text-neutral-400 truncate">Door: {user?.full_name}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium text-neutral-600">
                          {new Date(bp.start_time).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          {new Date(bp.start_time).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} - {new Date(bp.end_time).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DUAL FORMS ROW: MARK BUSY & PLAN EVENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* FORM A: Mark Yourself Busy */}
            <div className="bg-container-bg border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold tracking-tight">Markeer jezelf als bezet</h3>
              <form onSubmit={handleMarkBusy} className="space-y-3">
                <input
                  type="text"
                  placeholder="Wat ben je aan het doen? (bijv. Werk)"
                  value={busyTitle}
                  onChange={(e) => setBusyTitle(e.target.value)}
                  className="w-full bg-background rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-black/10"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Van</label>
                    <input type="datetime-local" value={busyStart} onChange={(e) => setBusyStart(e.target.value)} required className="w-full bg-background rounded-xl p-2.5 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Tot</label>
                    <input type="datetime-local" value={busyEnd} onChange={(e) => setBusyEnd(e.target.value)} required className="w-full bg-background rounded-xl p-2.5 text-xs outline-none" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold py-2.5 rounded-xl transition-all">
                  Tijdstip Blokkeren
                </button>
              </form>
            </div>

            {/* FORM B: Plan Event (Apple Form Style) */}
            <div className="bg-container-bg border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold tracking-tight text-foreground">Nieuwe Hangout Plannen</h3>
              <form onSubmit={handleCreateEvent} className="space-y-3">
                <input
                  type="text"
                  placeholder="Event Titel (bijv. Barbecue)"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  required
                  className="w-full bg-background rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-black/10"
                />
                <input
                  type="text"
                  placeholder="Adres / Locatie"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full bg-background rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-black/10"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Start</label>
                    <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="w-full bg-background rounded-xl p-2.5 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase">Einde</label>
                    <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="w-full bg-background rounded-xl p-2.5 text-xs outline-none" />
                  </div>
                </div>
                
                <input
                  type="text"
                  placeholder="Dresscode (optioneel)"
                  value={dresscode}
                  onChange={(e) => setDresscode(e.target.value)}
                  className="w-full bg-background rounded-xl p-3 text-xs outline-none"
                />

                <div className="flex items-center justify-between py-1 px-1">
                  <span className="text-xs font-medium text-neutral-600">Bring List Activeren?</span>
                  <input
                    type="checkbox"
                    checked={hasBringList}
                    onChange={(e) => setHasBringList(e.target.checked)}
                    className="rounded text-foreground focus:ring-0 w-4 h-4"
                  />
                </div>

                {hasBringList && (
                  <input
                    type="text"
                    placeholder="Items (gescheiden door komma's, bijv: Cola, Chips, Vlees)"
                    value={bringItems}
                    onChange={(e) => setBringItems(e.target.value)}
                    className="w-full bg-background rounded-xl p-3 text-xs outline-none border border-border animate-fadeIn"
                  />
                )}

                <button type="submit" className="w-full bg-black hover:opacity-90 text-white text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm">
                  Hangout Bevestigen
                </button>
              </form>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}