/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";

interface Group {
  id: string;
  name: string;
  join_code: string;
  invite_code: string;
  is_protected: boolean;
}

interface PendingRequest {
  id: string;
  group_id: string;
  user_id: string;
  group_name: string;
  user_name: string;
  avatar_url: string;
}

export default function GroupsPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  
  // Forms & UI Modals
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [isProtected, setIsProtected] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");

  // Native iOS Push Notificatie Toast State
  const [toast, setToast] = useState<{ message: string; sub?: string } | null>(null);

  const showNotification = (message: string, sub?: string) => {
    setToast({ message, sub });
    setTimeout(() => setToast(null), 4000);
  };

  async function loadGroupsData() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;
    const currentUserId = userData.user.id;
    setUserId(currentUserId);

    // 1. Haal groepen op waar de gebruiker actief lid van is (via user_id ipv profile_id)
    const { data: myMemberships } = await supabase
      .from("group_members")
      .select("group_id, status")
      .eq("user_id", currentUserId)
      .eq("status", "active");

    if (myMemberships && myMemberships.length > 0) {
      const groupIds = myMemberships.map(m => m.group_id);
      const { data: groupsData } = await supabase
        .from("groups")
        .select("id, name, join_code, invite_code, is_protected")
        .in("id", groupIds);
      
      if (groupsData) setGroups(groupsData);

      // 2. Haal openstaande toelatingsverzoeken (pending) op voor deze groepen
      const { data: incoming } = await supabase
        .from("group_members")
        .select(`
          id,
          group_id,
          user_id,
          groups:group_id ( name ),
          profiles:user_id ( full_name, avatar_url )
        `)
        .in("group_id", groupIds)
        .eq("status", "pending");

      if (incoming) {
        const formattedRequests = (incoming as any[]).map(req => ({
          id: req.id,
          group_id: req.group_id,
          user_id: req.user_id,
          group_name: req.groups?.name || "Groep",
          user_name: req.profiles?.full_name || "Iemand",
          avatar_url: req.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${req.user_id}`
        }));
        setPendingRequests(formattedRequests);
      }
    } else {
      setGroups([]);
      setPendingRequests([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadGroupsData();
  }, []);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;

    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Fix: We sturen zowel join_code als invite_code mee om de not-null constraint te pleasen
    const { data: newGroup, error: groupError } = await supabase
      .from("groups")
      .insert({ 
        name: groupName.trim(), 
        join_code: generatedCode, 
        invite_code: generatedCode, 
        is_protected: isProtected,
        created_by: userId
      })
      .select()
      .single();

    if (groupError) {
      showNotification("Fout bij aanmaken", groupError.message);
      return;
    }

    // Fix: Maker direct toevoegen via 'user_id' ipv 'profile_id'
    await supabase.from("group_members").insert({
      group_id: newGroup.id,
      user_id: userId,
      status: "active"
    });

    // Optioneel: Update direct de actieve groep in het profiel van de student
    await supabase
      .from("profiles")
      .update({ selected_group_id: newGroup.id })
      .eq("id", userId);

    showNotification("Groep aangemaakt! 🎉", `Code: ${generatedCode}`);
    setGroupName("");
    setIsProtected(false);
    setShowCreateSheet(false);
    
    // Smooth state update in plaats van een harde window reload
    setLoading(true);
    await loadGroupsData();
  }

  async function handleJoinCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    // Zoek de groep via join_code
    const { data: targetGroup, error: findError } = await supabase
      .from("groups")
      .select("id, name, is_protected, join_code, invite_code")
      .eq("join_code", joinCodeInput.trim().toUpperCase())
      .maybeSingle();

    if (findError || !targetGroup) {
      showNotification("Code niet gevonden", "Controleer de code en probeer opnieuw.");
      return;
    }

    const memberStatus = targetGroup.is_protected ? "pending" : "active";

    // Fix: Invoegen met correcte kolomnaam 'user_id'
    const { error: joinError } = await supabase.from("group_members").insert({
      group_id: targetGroup.id,
      user_id: userId,
      status: memberStatus
    });

    if (joinError) {
      showNotification("Aanmeldingsfout", "Je bent mogelijk al lid of hebt een verzoek openstaan.");
    } else if (targetGroup.is_protected) {
      showNotification("Verzoek verzonden! 🔒", `Wacht tot de leden van ${targetGroup.name} je toelaten.`);
    } else {
      showNotification("Succesvol toegevoegd! 🎉", `Je zit nu in ${targetGroup.name}`);
      
      // Update ook direct de geselecteerde groep voor directe toegang in de UI
      await supabase
        .from("profiles")
        .update({ selected_group_id: targetGroup.id })
        .eq("id", userId);
    }

    setJoinCodeInput("");
    setShowJoinSheet(false);
    
    setLoading(true);
    await loadGroupsData();
  }

  async function handleResolveRequest(requestId: string, approve: boolean) {
    if (approve) {
      await supabase
        .from("group_members")
        .update({ status: "active" })
        .eq("id", requestId);
      showNotification("Lid toegelaten");
    } else {
      await supabase
        .from("group_members")
        .delete()
        .eq("id", requestId);
      showNotification("Verzoek geweigerd");
    }
    
    // Instant UI update van de lopende verzoeken
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    
    // Ververs het groepenoverzicht mocht er iemand zijn toegelaten
    if (approve) {
      await loadGroupsData();
    }
  }

  if (loading) return <div className="p-6 text-sm text-neutral-400 font-medium">Groepen laden...</div>;

  return (
    <div className="space-y-8 relative page-transition-wrapper">
      
      {/* NATIVE PUSH TOAST BANNER */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-50 flex justify-center pointer-events-none animate-fade-in">
          <div className="bg-black/95 text-white w-full max-w-sm rounded-2xl p-4 shadow-2xl backdrop-blur-md border border-white/10 flex items-start space-x-3 pointer-events-auto">
            <div className="bg-white/20 h-7 w-7 rounded-lg flex items-center justify-center text-xs">💬</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold tracking-tight">{toast.message}</p>
              {toast.sub && <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{toast.sub}</p>}
            </div>
          </div>
        </div>
      )}

      {/* TITEL & ACTIONS */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">Groepen</h1>
          <p className="text-sm text-neutral-400 font-medium mt-0.5">Beheer je vriendengroepen en toelatingen.</p>
        </div>
      </div>

      {/* GEBRUIKER IS NOG GEEN LID MELDING */}
      {groups.length === 0 && (
        <div className="bg-neutral-50 rounded-2xl p-8 text-center max-w-md mx-auto border border-neutral-100/40 animate-fade-in">
          <p className="text-sm text-neutral-500 mb-4">Je bent momenteel geen actief lid van een groep.</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => setShowJoinSheet(true)} className="bg-neutral-100 text-neutral-800 text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95 transition">Code Invullen</button>
            <button onClick={() => setShowCreateSheet(true)} className="bg-black text-white text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95 transition">Nieuwe Groep</button>
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-6">
          
          {/* TOELATINGSVERZOEKEN NOTIFICATIE LIJST */}
          {pendingRequests.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200/40 rounded-2xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-center space-x-1.5">
                <span className="text-amber-600 text-xs font-extrabold uppercase tracking-wider">🔒 Toelatingsverzoeken ({pendingRequests.length})</span>
              </div>
              <div className="space-y-2">
                {pendingRequests.map(req => (
                  <div key={req.id} className="bg-white p-3 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="relative w-6 h-6 rounded-full overflow-hidden shrink-0">
                        <Image src={req.avatar_url} alt="Avatar" fill className="object-cover" unoptimized />
                      </div>
                      <p className="text-xs font-semibold text-neutral-800 truncate">
                        <strong>{req.user_name}</strong> wil naar <em>{req.group_name}</em>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleResolveRequest(req.id, false)} className="text-[11px] font-bold text-neutral-400 hover:text-red-500 px-2 py-1">Weiger</button>
                      <button onClick={() => handleResolveRequest(req.id, true)} className="bg-black text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">Laat toe</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GROEPEN OVERZICHT MATRIX */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
            {groups.map(g => (
              <div key={g.id} className="bg-white border border-neutral-100/70 p-5 rounded-2xl shadow-xs flex flex-col justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-neutral-900 text-lg">{g.name}</h3>
                    <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md ${
                      g.is_protected ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
                    }`}>
                      {g.is_protected ? "🔒 Beveiligd" : "🔓 Open"}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-medium">Deel deze code met je vrienden:</p>
                </div>

                <div className="w-full flex items-center justify-between bg-neutral-50 p-2 rounded-xl">
                  <code className="text-xs font-bold text-neutral-700 tracking-wider pl-1">{g.join_code}</code>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(g.join_code);
                      showNotification("Code Gekopieerd! 📋", `Deel ${g.join_code} met je vrienden.`);
                    }}
                    className="text-[11px] font-bold text-neutral-500 hover:text-black px-2 py-1 bg-white rounded-lg shadow-2xs"
                  >
                    Kopieer
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* EXTRA ACTIONS ONDERAAN */}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowJoinSheet(true)} className="px-4 py-3 bg-neutral-100 text-neutral-800 text-xs font-bold rounded-xl active:scale-95 transition">Vul een Groepscode in</button>
            <button onClick={() => setShowCreateSheet(true)} className="px-4 py-3 bg-black text-white text-xs font-bold rounded-xl active:scale-95 transition">+ Nieuwe Groep Starten</button>
          </div>
        </div>
      )}

      {/* ================= NATIVE APPLE MODAL SHEETS ================= */}

      {/* SHEET A: NIEUWE GROEP MAKEN */}
      {showCreateSheet && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl animate-sheet-in">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h2 className="text-sm font-bold">Groep Aanmaken</h2>
              <button onClick={() => setShowCreateSheet(false)} className="text-xs font-bold text-neutral-400">Annuleer</button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <input type="text" placeholder="Groepsnaam (bijv. Vriendengroep 2026)" value={groupName} onChange={(e) => setGroupName(e.target.value)} required className="w-full bg-neutral-50 p-3.5 rounded-xl text-xs outline-none" />
              
              {/* APPLE SEGMENTED SWITCH VOOR TYPE GROEP */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase px-1">Groepstype</label>
                <div className="bg-neutral-100 p-1 rounded-xl flex">
                  <button type="button" onClick={() => setIsProtected(false)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${!isProtected ? "bg-white text-black shadow-xs" : "text-neutral-500"}`}>🔓 Open</button>
                  <button type="button" onClick={() => setIsProtected(true)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${isProtected ? "bg-white text-black shadow-xs" : "text-neutral-500"}`}>🔒 Beveiligd</button>
                </div>
                <p className="text-[10px] text-neutral-400 px-1 mt-1 leading-normal">
                  {isProtected 
                    ? "Nieuwe leden sturen een verzoek. Huidige leden moeten hen eerst goedkeuren." 
                    : "Iedereen met de unieke groepscode krijgt direct volledige toegang tot de agenda."}
                </p>
              </div>

              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-xs font-semibold shadow-sm">Maak Groep</button>
            </form>
          </div>
        </div>
      )}

      {/* SHEET B: JOINEN VIA CODE */}
      {showJoinSheet && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl animate-sheet-in">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h2 className="text-sm font-bold">Deelnemen via Code</h2>
              <button onClick={() => setShowJoinSheet(false)} className="text-xs font-bold text-neutral-400">Annuleer</button>
            </div>
            <form onSubmit={handleJoinCodeSubmit} className="space-y-4">
              <input type="text" placeholder="Voer de 6-cijferige code in" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} required className="w-full bg-neutral-50 p-3.5 rounded-xl text-xs font-bold tracking-widest text-center uppercase outline-none" maxLength={6} />
              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-xs font-semibold shadow-sm">Verstuur Code</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}