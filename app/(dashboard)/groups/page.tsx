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
  created_at: string;
}

interface GroupMemberDetail {
  user_id: string;
  full_name: string;
  avatar_url: string;
}

export default function GroupsPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  
  // Modals & Sheets State
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  const [showMembersSheet, setShowMembersSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form inputs & Selected items
  const [groupName, setGroupName] = useState("");
  const [isProtected, setIsProtected] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<GroupMemberDetail[]>([]);
  const [editGroupNameInput, setEditGroupNameInput] = useState("");

  // Native iOS Push Notificatie Toast
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

    // 1. Haal alle actieve groepen van de user op
    const { data: myMemberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", currentUserId)
      .eq("status", "active");

    if (myMemberships && myMemberships.length > 0) {
      const groupIds = myMemberships.map(m => m.group_id);
      const { data: groupsData } = await supabase
        .from("groups")
        .select("id, name, join_code, invite_code, is_protected")
        .in("id", groupIds);
      
      if (groupsData) setGroups(groupsData);

      // 2. Notificaties/Meldingen: Haal binnenkomende verzoeken op voor MIJN groepen
      // We halen ook created_at op om tijdstip van verzending te tonen
      const { data: incoming } = await supabase
        .from("group_members")
        .select(`
          id,
          group_id,
          user_id,
          created_at,
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
          avatar_url: req.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${req.user_id}`,
          created_at: req.created_at
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

    await supabase.from("group_members").insert({
      group_id: newGroup.id,
      user_id: userId,
      status: "active"
    });

    showNotification("Groep aangemaakt! 🎉", `Code: ${generatedCode}`);
    setGroupName("");
    setIsProtected(false);
    setShowCreateSheet(false);
    
    setLoading(true);
    await loadGroupsData();
  }

  async function handleJoinCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    const { data: targetGroup, error: findError } = await supabase
      .from("groups")
      .select("id, name, is_protected")
      .eq("join_code", joinCodeInput.trim().toUpperCase())
      .maybeSingle();

    if (findError || !targetGroup) {
      showNotification("Code niet gevonden", "Controleer de code en probeer opnieuw.");
      return;
    }

    const memberStatus = targetGroup.is_protected ? "pending" : "active";

    const { error: joinError } = await supabase.from("group_members").insert({
      group_id: targetGroup.id,
      user_id: userId,
      status: memberStatus
    });

    if (joinError) {
      showNotification("Aanmeldingsfout", "Je bent mogelijk al lid of hebt al een verzoek openstaan.");
    } else if (targetGroup.is_protected) {
      showNotification("Verzoek verzonden! 🔒", `Wacht tot de leden van ${targetGroup.name} je toelaten.`);
    } else {
      showNotification("Succesvol toegevoegd! 🎉", `Je zit nu in ${targetGroup.name}`);
    }

    setJoinCodeInput("");
    setShowJoinSheet(false);
    setLoading(true);
    await loadGroupsData();
  }

  async function handleResolveRequest(requestId: string, approve: boolean) {
    if (approve) {
      await supabase.from("group_members").update({ status: "active" }).eq("id", requestId);
      showNotification("Lid toegelaten");
    } else {
      await supabase.from("group_members").delete().eq("id", requestId);
      showNotification("Verzoek geweigerd");
    }
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    await loadGroupsData();
  }

  // Open ledenlijst modal en haal realtime op wie erin zit
  async function openMembersList(group: Group) {
    setSelectedGroup(group);
    setShowMembersSheet(true);

    const { data: membersData } = await supabase
      .from("group_members")
      .select(`
        user_id,
        profiles:user_id ( full_name, avatar_url )
      `)
      .eq("group_id", group.id)
      .eq("status", "active");

    if (membersData) {
      const formatted = (membersData as any[]).map(m => ({
        user_id: m.user_id,
        full_name: m.profiles?.full_name || "Onbekende Vriend",
        avatar_url: m.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.user_id}`
      }));
      setSelectedGroupMembers(formatted);
    }
  }

  // Wijzig groepsnaam (kan elk lid doen)
  async function handleEditGroupName(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroup || !editGroupNameInput.trim()) return;

    const { error } = await supabase
      .from("groups")
      .update({ name: editGroupNameInput.trim() })
      .eq("id", selectedGroup.id);

    if (!error) {
      showNotification("Groepsnaam aangepast!");
      setShowEditSheet(false);
      await loadGroupsData();
    }
  }

  // Groep verlaten logica + luie opschoning
  async function handleLeaveGroupTrigger(group: Group) {
    setSelectedGroup(group);
    
    // Check hoeveel actieve leden de groep heeft
    const { count } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", group.id)
      .eq("status", "active");

    if (count && count <= 1) {
      // Laatste lid! Toon nucleaire popup waarschuwing
      setShowDeleteConfirm(true);
    } else {
      // Gewoon verlaten zonder de groep te slopen
      if (confirm(`Weet je zeker dat je ${group.name} wilt verlaten?`)) {
        await executeLeave(group.id, false);
      }
    }
  }

  async function executeLeave(groupId: string, deleteEntireGroup: boolean) {
    // 1. Verwijder het lidmaatschap (wist direct de binding)
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    
    // 2. Verwijder ook direct alle drukke uren van deze user uit deze specifieke groep
    await supabase.from("availability_slots").delete().eq("group_id", groupId).eq("user_id", userId);

    if (deleteEntireGroup) {
      // Sloop de groep en alle overgebleven data (cascade-stijl opruimen)
      await supabase.from("group_members").delete().eq("group_id", groupId);
      await supabase.from("availability_slots").delete().eq("group_id", groupId);
      await supabase.from("events").delete().eq("group_id", groupId);
      await supabase.from("groups").delete().eq("id", groupId);
      showNotification("Groep definitief verwijderd");
    } else {
      showNotification("Je hebt de groep verlaten");
    }

    setShowDeleteConfirm(false);
    setLoading(true);
    await loadGroupsData();
  }

  if (loading) return <div className="p-6 text-sm text-neutral-400 font-medium">Groepen laden...</div>;

  return (
    <div className="space-y-8 relative page-transition-wrapper min-h-screen pb-20">
      
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

      {/* HEADER ACTIES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">Groepen</h1>
          <p className="text-sm text-neutral-400 font-medium mt-0.5">Beheer je groepen, bekijk leden of voer codes in.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowJoinSheet(true)} className="px-4 py-2.5 bg-neutral-100 text-neutral-800 text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer">Code Invullen</button>
          <button onClick={() => setShowCreateSheet(true)} className="px-4 py-2.5 bg-black text-white text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer">+ Nieuwe Groep</button>
        </div>
      </div>

      {/* MELDINGEN / NOTIFICATIES COMPONENT */}
      <div className="space-y-3">
        <h2 className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider px-1">🔔 Meldingen & Verzoeken</h2>
        {pendingRequests.length === 0 ? (
          <p className="text-xs text-neutral-400 italic px-1">Geen ongelezen meldingen of openstaande verzoeken.</p>
        ) : (
          <div className="space-y-2 animate-fade-in">
            {pendingRequests.map(req => {
              const dateObj = new Date(req.created_at);
              const formattedTime = dateObj.toLocaleDateString("nl-BE", { day: "numeric", month: "short" }) + " om " + dateObj.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });

              return (
                <div key={req.id} className="bg-amber-50/70 border border-amber-200/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 border border-amber-200 bg-white">
                      <Image src={req.avatar_url} alt="Avatar" fill className="object-cover" unoptimized />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs text-neutral-800 leading-normal">
                        <strong className="font-bold text-neutral-900">{req.user_name}</strong> wilt graag lid worden van de beveiligde groep <em className="font-semibold text-neutral-900 font-serif">“{req.group_name}”</em>.
                      </p>
                      <span className="text-[10px] text-neutral-400 block font-medium">{formattedTime}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button onClick={() => handleResolveRequest(req.id, false)} className="text-xs font-bold text-neutral-500 hover:text-red-600 px-3 py-1.5 rounded-lg transition cursor-pointer">Weiger</button>
                    <button onClick={() => handleResolveRequest(req.id, true)} className="bg-black text-white text-xs font-bold px-4 py-1.5 rounded-xl shadow-xs cursor-pointer">Accepteer</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTIEVE GROEPEN VAN DE GEBRUIKER */}
      <div className="space-y-4 pt-4">
        <h2 className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider px-1">👥 Mijn Actieve Groepen ({groups.length})</h2>
        
        {groups.length === 0 ? (
          <div className="bg-neutral-50 rounded-2xl p-8 text-center border border-neutral-100/40 animate-fade-in">
            <p className="text-sm text-neutral-400">Je bent momenteel nog geen lid van een actieve vriendengroep.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            {groups.map(g => (
              <div key={g.id} className="bg-white border border-neutral-100 p-5 rounded-2xl shadow-2xs flex flex-col justify-between gap-4">
                <div className="w-full flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-neutral-900 text-lg tracking-tight">{g.name}</h3>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md ${
                        g.is_protected ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {g.is_protected ? "🔒 Beveiligd" : "🔓 Open"}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 font-medium">Groepscode: <code className="font-mono font-bold text-neutral-700 bg-neutral-50 px-1 py-0.5 rounded">{g.join_code}</code></p>
                  </div>
                  
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(g.join_code);
                      showNotification("Code Gekopieerd! 📋", `Deel code ${g.join_code} met je vrienden.`);
                    }}
                    className="text-[11px] font-bold text-neutral-500 bg-neutral-50 hover:bg-neutral-100 px-2.5 py-1 rounded-lg shadow-3xs cursor-pointer transition"
                  >
                    Kopieer Code
                  </button>
                </div>

                {/* SLIMME CONTROLS & BEHEERKNOPPEN ONDERAAN ELK ELEMENT */}
                <div className="flex items-center justify-between w-full pt-2 border-t border-neutral-50">
                  <div className="flex gap-1.5">
                    <button onClick={() => openMembersList(g)} className="text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200/70 px-3 py-1.5 rounded-xl transition cursor-pointer">Leden</button>
                    <button onClick={() => { setSelectedGroup(g); setEditGroupNameInput(g.name); setShowEditSheet(true); }} className="text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200/70 px-3 py-1.5 rounded-xl transition cursor-pointer">Bewerk</button>
                  </div>
                  <button onClick={() => handleLeaveGroupTrigger(g)} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-xl transition cursor-pointer">Verlaat Groep</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= NATIVE FULL SCREEN BACKDROP MODAL SHEETS ================= */}

      {/* SHEET A: NIEUWE GROEP MAKEN */}
      {showCreateSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl animate-sheet-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h2 className="text-sm font-bold text-neutral-900">Groep Aanmaken</h2>
              <button onClick={() => setShowCreateSheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <input type="text" placeholder="Groepsnaam (bijv. Vriendengroep 2026)" value={groupName} onChange={(e) => setGroupName(e.target.value)} required className="w-full bg-neutral-50 p-3.5 rounded-xl text-xs outline-none text-neutral-900 font-medium" />
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase px-1">Groepstype</label>
                <div className="bg-neutral-100 p-1 rounded-xl flex">
                  <button type="button" onClick={() => setIsProtected(false)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${!isProtected ? "bg-white text-black shadow-xs" : "text-neutral-500"}`}>🔓 Open</button>
                  <button type="button" onClick={() => setIsProtected(true)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${isProtected ? "bg-white text-black shadow-xs" : "text-neutral-500"}`}>🔒 Gesloten</button>
                </div>
                <p className="text-[10px] text-neutral-400 px-1 mt-1 leading-normal">
                  {isProtected 
                    ? "Leden sturen een verzoek. Dit verschijnt in de 'Meldingen' tab bij groepsleden ter goedkeuring." 
                    : "Iedereen met de unieke groepscode krijgt direct en zonder goedkeuring volledige toegang."}
                </p>
              </div>
              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-xs font-semibold shadow-sm cursor-pointer">Maak Groep</button>
            </form>
          </div>
        </div>
      )}

      {/* SHEET B: JOINEN VIA CODE */}
      {showJoinSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl animate-sheet-in">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h2 className="text-sm font-bold text-neutral-900">Deelnemen via Code</h2>
              <button onClick={() => setShowJoinSheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            <form onSubmit={handleJoinCodeSubmit} className="space-y-4">
              <input type="text" placeholder="Voer de 6-cijferige code in" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} required className="w-full bg-neutral-50 p-3.5 rounded-xl text-xs font-bold tracking-widest text-center uppercase outline-none text-neutral-900" maxLength={6} />
              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-xs font-semibold shadow-sm cursor-pointer">Verstuur Code</button>
            </form>
          </div>
        </div>
      )}

      {/* SHEET C: LEDENLIJST MODAL */}
      {showMembersSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl animate-sheet-in max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3 shrink-0">
              <div>
                <h2 className="text-sm font-black text-neutral-900">{selectedGroup?.name}</h2>
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">Aantal Leden: {selectedGroupMembers.length}</p>
              </div>
              <button onClick={() => { setShowMembersSheet(false); setSelectedGroupMembers([]); }} className="text-xs font-bold text-neutral-400 cursor-pointer">Sluit</button>
            </div>
            <div className="overflow-y-auto space-y-3 py-2 scrollbar-none flex-1">
              {selectedGroupMembers.map(m => (
                <div key={m.user_id} className="flex items-center space-x-3 p-1 rounded-xl">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-neutral-100">
                    <Image src={m.avatar_url} alt="Avatar" fill className="object-cover" unoptimized />
                  </div>
                  <p className="text-xs font-bold text-neutral-800">{m.full_name} {m.user_id === userId && <span className="text-[10px] font-medium text-neutral-400 bg-neutral-50 px-1 py-0.5 rounded">(Jij)</span>}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHEET D: GROEP BEWERKEN MODAL */}
      {showEditSheet && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl animate-sheet-in">
            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
              <h2 className="text-sm font-bold text-neutral-900">Groepsnaam Aanpassen</h2>
              <button onClick={() => setShowEditSheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            <form onSubmit={handleEditGroupName} className="space-y-4">
              <input type="text" value={editGroupNameInput} onChange={(e) => setEditGroupNameInput(e.target.value)} required className="w-full bg-neutral-50 p-3.5 rounded-xl text-xs outline-none text-neutral-900 font-bold" />
              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-xs font-semibold shadow-sm cursor-pointer">Opslaan</button>
            </form>
          </div>
        </div>
      )}

      {/* SHEET E: LAATSTE LID CRITICAL REMOVE POPUP */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl border border-neutral-100 text-center animate-sheet-in">
            <div className="mx-auto w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-xl">⚠️</div>
            <div className="space-y-1">
              <h3 className="font-black text-neutral-900 text-base">Laatste lid waarschuwing</h3>
              <p className="text-xs text-neutral-500 leading-normal">Je bent het laatste lid van <span className="font-bold text-neutral-800">{selectedGroup?.name}</span>. Als je weggaat, zal de groep en alle bijbehorende agenda-items definitief worden verwijderd.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 bg-neutral-100 text-neutral-800 text-xs font-bold rounded-xl cursor-pointer">Annuleer</button>
              <button onClick={() => selectedGroup && executeLeave(selectedGroup.id, true)} className="flex-1 py-2.5 bg-red-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer">Verwijder Groep</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}