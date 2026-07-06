/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import React, { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import { useNavData } from "../../../hooks/useNavData";
import { mutate } from "swr";
import { Check } from "lucide-react";

interface Group {
  id: string;
  name: string;
  join_code: string;
  invite_code: string;
  is_protected: boolean;
}

interface GroupMemberDetail {
  user_id: string;
  full_name: string;
  avatar_url: string;
}

export default function GroupsPage() {
  // 1. SYSTEM-WIDE COHERENT SHARED CACHE ACCESS
  const { data: navData, mutate: mutateNav } = useNavData();
  const activeGroupId = (navData as any)?.activeGroup?.id;
  const userId = (navData as any)?.profile?.id || "";
  const groups = (navData as any)?.groups || [];

  const [isPending, startTransition] = useTransition();

  // Custom Dynamic Font State
  const [activeFont, setActiveFont] = useState("inherit");
  
  // Modals & Sheets State
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  const [showMembersSheet, setShowMembersSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showLeaveConfirmSheet, setShowLeaveConfirmSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form inputs & Selected items
  const [groupName, setGroupName] = useState("");
  const [isProtected, setIsProtected] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<GroupMemberDetail[]>([]);
  const [editGroupNameInput, setEditGroupNameInput] = useState("");

  // Premium Instagram-Style Dynamic Toast
  const [toast, setToast] = useState<{ message: string; sub?: string } | null>(null);

  const showNotification = (message: string, sub?: string) => {
    setToast({ message, sub });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Keep theme/font syncing cleanly isolated
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedFont = localStorage.getItem("app-custom-font");
      if (storedFont) setActiveFont(storedFont);
    }
  }, []);

  // 2. LIGHTNING-FAST WORKSPACE TOGGLER (OPTIMISTIC MUTATION)
  async function handleSelectActiveGroup(groupId: string) {
    if (!userId || groupId === activeGroupId) return;

    // Instantly modify layout memory block before hitting network
    mutateNav(
      (old: any) => ({
        ...old,
        activeGroup: old?.groups?.find((g: any) => g.id === groupId) || old?.activeGroup,
        profile: old?.profile ? { ...old.profile, selected_group_id: groupId } : old?.profile,
      }),
      false
    );

    showNotification("Werkruimte gewisseld! ✨");

    await supabase.from("profiles").update({ selected_group_id: groupId }).eq("id", userId);
    
    // Globally prompt revalidation for keys depending on active group mutations
    mutateNav();
    mutate((key) => Array.isArray(key) && key.includes(groupId));
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim() || !userId) return;
  
    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const prospectiveGroup: Group = {
      id: "temp-" + Math.random().toString(),
      name: groupName.trim(),
      join_code: generatedCode,
      invite_code: generatedCode,
      is_protected: isProtected
    };
  
    // Optimistic UI Update
    mutateNav(
      (old: any) => ({
        ...old,
        groups: [...(old?.groups || []), prospectiveGroup],
        activeGroup: prospectiveGroup,
      }),
      false
    );
  
    showNotification("Groep aangemaakt", `Code: ${generatedCode}`);
    setGroupName("");
    setIsProtected(false);
    setShowCreateSheet(false);
  
// 1. Voeg de groep toe
const { data: insertedGroups, error: groupError } = await supabase
.from("groups")
.insert({ 
  name: prospectiveGroup.name, 
  join_code: generatedCode, 
  invite_code: generatedCode, 
  is_protected: isProtected,
  created_by: userId
})
.select();

if (groupError || !insertedGroups || insertedGroups.length === 0) {
showNotification("Fout bij aanmaken", groupError?.message || "Geen data teruggekregen");
mutateNav();
return;
}

const createdGroup = insertedGroups[0];

// 2. Voeg de maker DIRECT toe als actief lid
const { error: memberError } = await supabase
.from("group_members")
.insert({
  group_id: createdGroup.id,
  user_id: userId,
  status: "active"
});

if (memberError) {
console.error("Fout bij lidmaatschap:", memberError.message);
}

// 3. Update de geselecteerde groep in het profiel
await supabase
.from("profiles")
.update({ selected_group_id: createdGroup.id })
.eq("id", userId);
    
    // 4. Forceer harde sync van alle nav-data over de hele app
    mutateNav();
  }

  async function handleJoinCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCodeInput.trim() || !userId) return;

    const { data: targetGroup, error: findError } = await supabase
      .from("groups")
      .select("id, name, is_protected")
      .eq("join_code", joinCodeInput.trim().toUpperCase())
      .maybeSingle();

    if (findError || !targetGroup) {
      showNotification("Code niet gevonden 🔍", "Controleer de code en probeer het opnieuw.");
      return;
    }

    const memberStatus = targetGroup.is_protected ? "pending" : "active";

    const { error: joinError } = await supabase.from("group_members").insert({
      group_id: targetGroup.id,
      user_id: userId,
      status: memberStatus
    });

    if (joinError) {
      showNotification("Lidmaatschap mislukt 🔒", "Je zit al in deze groep of je verzoek staat open.");
    } else if (targetGroup.is_protected) {
      showNotification("Verzoek verzonden 📩", `Wacht tot leden van ${targetGroup.name} je accepteren.`);
    } else {
      showNotification("Groep toegevoegd! ✨", `Je bent nu lid van ${targetGroup.name}`);
      
      // Update local profile scope immediately if connection is open
      mutateNav(
        (old: any) => ({
          ...old,
          groups: [...(old?.groups || []), targetGroup],
          activeGroup: targetGroup,
        }),
        false
      );

      await supabase.from("profiles").update({ selected_group_id: targetGroup.id }).eq("id", userId);
    }

    setJoinCodeInput("");
    setShowJoinSheet(false);
    mutateNav();
  }
  
  async function openMembersList(group: Group) {
    setSelectedGroup(group);
    setShowMembersSheet(true);

    const { data: membersData } = await supabase
      .from("group_members")
      .select(`
        user_id,
        status,
        profiles ( full_name, avatar_url )
      `)
      .eq("group_id", group.id)
      .eq("status", "active");

    if (membersData) {
      const formatted = membersData.map((m: any) => ({
        user_id: m.user_id,
        full_name: m.profiles?.full_name || "Lid " + m.user_id.substring(0,4),
        avatar_url: m.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.user_id}`
      }));
      setSelectedGroupMembers(formatted);
    }
  }

  async function handleEditGroupName(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroup || !editGroupNameInput.trim()) return;

    // Local state projection updates instantly
    mutateNav(
      (old: any) => ({
        ...old,
        groups: old?.groups?.map((g: any) => g.id === selectedGroup.id ? { ...g, name: editGroupNameInput.trim() } : g) || [],
        activeGroup: old?.activeGroup?.id === selectedGroup.id ? { ...old.activeGroup, name: editGroupNameInput.trim() } : old?.activeGroup
      }),
      false
    );

    showNotification("Groepsnaam bijgewerkt 📝");
    setShowEditSheet(false);

    await supabase
      .from("groups")
      .update({ name: editGroupNameInput.trim() })
      .eq("id", selectedGroup.id);

    mutateNav();
  }

  async function handleLeaveGroupTrigger(group: Group) {
    setSelectedGroup(group);
    const { count } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", group.id)
      .eq("status", "active");

    if (count && count <= 1) {
      setShowDeleteConfirm(true);
    } else {
      setShowLeaveConfirmSheet(true);
    }
  }

  async function executeLeave(groupId: string, deleteEntireGroup: boolean) {
    // Optimistic slice tracking
    mutateNav(
      (old: any) => {
        const remaining = old?.groups?.filter((g: any) => g.id !== groupId) || [];
        return {
          ...old,
          groups: remaining,
          activeGroup: old?.activeGroup?.id === groupId ? (remaining[0] || null) : old?.activeGroup
        };
      },
      false
    );

    if (deleteEntireGroup) {
      showNotification("Groep definitief verwijderd 🗑️");
    } else {
      showNotification("Groep verlaten 🚶‍♂️");
    }

    setShowDeleteConfirm(false);
    setShowLeaveConfirmSheet(false);

    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    await supabase.from("availability_slots").delete().eq("group_id", groupId).eq("user_id", userId);

    if (deleteEntireGroup) {
      await supabase.from("group_members").delete().eq("group_id", groupId);
      await supabase.from("availability_slots").delete().eq("group_id", groupId);
      await supabase.from("events").delete().eq("group_id", groupId);
      await supabase.from("groups").delete().eq("id", groupId);
    }

    // Set fallback active layout selection
    // 1. Calculate a fallback group from your groups array safely
const userGroups = (navData as any)?.groups || [];
const remainingGroups = userGroups.filter((g: any) => g.id !== groupId);
const nextFallbackId = remainingGroups[0]?.id || null;

// 2. Perform the database update with the calculated fallback variable
await supabase
  .from("profiles")
  .update({ selected_group_id: nextFallbackId })
  .eq("id", userId);
  }

  return (
    <div style={{ fontFamily: activeFont }} className="space-y-8 relative min-h-screen pb-20 select-none animate-in fade-in">
      
      {/* FLOATING TOAST BANNER */}
      {toast && (
        <div className="fixed bottom-20 left-4 right-4 z-[10000] flex justify-center pointer-events-none">
          <div className="bg-neutral-900/95 border border-white/10 text-white w-full max-w-sm rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl flex items-center space-x-3 pointer-events-auto">
            <div className="bg-container-bg/10 h-8 w-8 rounded-full flex items-center justify-center text-sm shrink-0">💬</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold tracking-tight text-neutral-50">{toast.message}</p>
              {toast.sub && <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{toast.sub}</p>}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Groepen</h1>
          <p className="text-xs font-bold text-neutral-400 mt-0.5">Tik op een kaart om die groep direct te activeren.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowJoinSheet(true)} className="px-3.5 py-2 bg-neutral-100 text-neutral-800 text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer">Code Invullen</button>
          <button onClick={() => setShowCreateSheet(true)} className="px-3.5 py-2 bg-btn-bg text-btn-text text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer">+ Nieuwe Groep</button>
        </div>
      </div>

      {/* GRID OVERZICHT MET INGEBOUWDE SELECTOR */}
      <div className="space-y-4">
        <h2 className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider px-1">Mijn Vriendengroepen ({groups.length})</h2>
        
        {groups.length === 0 ? (
          <div className="bg-background rounded-2xl p-8 text-center border border-border/40">
            <p className="text-sm text-neutral-400 font-bold">Je bent nog geen lid van een actieve vriendengroep.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           {groups.map((g: any) => {
              const isActive = g.id === activeGroupId;
              return (
                <div 
                  key={g.id} 
                  onClick={() => handleSelectActiveGroup(g.id)}
                  className={`border p-5 rounded-2xl shadow-3xs flex flex-col justify-between gap-4 transition-all cursor-pointer relative ${
                    isActive ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-container-bg border-border hover:border-border text-foreground"
                  }`}
                >
                  {/* Active Indicator Checkmark */}
                  {isActive && (
                    <div className="absolute top-4 right-4 bg-container-bg/20 p-1 rounded-full text-white">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}

                  <div className="space-y-1 pr-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-lg tracking-tight">{g.name}</h3>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md ${
                        isActive ? "bg-container-bg/10 text-neutral-200" : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {g.is_protected ? "🔒 Privé" : "🔓 Open"}
                      </span>
                    </div>
                    <p className={`text-[11px] font-medium ${isActive ? "text-neutral-400" : "text-neutral-400"}`}>
                      Code: <code className={`font-mono font-bold px-1 py-0.5 rounded ${isActive ? "bg-container-bg/10 text-white" : "bg-background text-neutral-700"}`}>{g.join_code}</code>
                    </p>
                  </div>

                  <div className={`flex items-center justify-between w-full pt-3 border-t ${isActive ? "border-white/10" : "border-neutral-50"}`} onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      <button onClick={() => openMembersList(g)} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer ${isActive ? "bg-container-bg/10 text-white hover:bg-container-bg/20" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70"}`}>Leden</button>
                      <button onClick={() => { setSelectedGroup(g); setEditGroupNameInput(g.name); setShowEditSheet(true); }} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer ${isActive ? "bg-container-bg/10 text-white hover:bg-container-bg/20" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70"}`}>Bewerk</button>
                    </div>
                    <button onClick={() => handleLeaveGroupTrigger(g)} className="text-[11px] font-bold text-red-500 hover:bg-red-50/10 px-2.5 py-1.5 rounded-xl transition cursor-pointer">Verlaat</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SHEET A: NIEUWE GROEP MAKEN */}
      {showCreateSheet && (
        <div className="fixed inset-0 z-[999] w-screen h-screen bg-neutral-900/20 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-container-bg/90 border border-white/20 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-black text-foreground">Groep Aanmaken</h2>
              <button onClick={() => setShowCreateSheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <input type="text" placeholder="Groepsnaam" value={groupName} onChange={(e) => setGroupName(e.target.value)} required className="w-full bg-background border p-3.5 rounded-xl text-xs outline-none text-foreground font-bold" />
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase px-1">Groepstype</label>
                <div className="bg-neutral-100 p-1 rounded-xl flex">
                  <button type="button" onClick={() => setIsProtected(false)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${!isProtected ? "bg-container-bg text-foreground shadow-3xs" : "text-neutral-500"}`}>🔓 Open</button>
                  <button type="button" onClick={() => setIsProtected(true)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${isProtected ? "bg-container-bg text-foreground shadow-3xs" : "text-neutral-500"}`}>🔒 Gesloten</button>
                </div>
              </div>
              <button type="submit" className="w-full bg-btn-bg text-btn-text p-3.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer active:scale-98 transition">Maak Groep</button>
            </form>
          </div>
        </div>
      )}

      {/* SHEET B: JOINEN VIA CODE */}
      {showJoinSheet && (
        <div className="fixed inset-0 z-[999] w-screen h-screen bg-neutral-900/20 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-container-bg/90 border border-white/20 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-black text-foreground">Deelnemen via Code</h2>
              <button onClick={() => setShowJoinSheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            <form onSubmit={handleJoinCodeSubmit} className="space-y-4">
              <input type="text" placeholder="CODE12" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} required className="w-full bg-background border p-3.5 rounded-xl text-sm font-black tracking-widest text-center uppercase outline-none text-foreground" maxLength={6} />
              <button type="submit" className="w-full bg-btn-bg text-btn-text p-3.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer active:scale-98 transition">Deelnemen</button>
            </form>
          </div>
        </div>
      )}
      
      {/* SHEET C: FULL SCREEN LEDENLIJST */}
      {showMembersSheet && (
        <div className="fixed inset-0 z-[9999] bg-container-bg flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="pt-12 pb-4 px-6 border-b border-border flex items-center justify-between shrink-0 bg-container-bg">
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">{selectedGroup?.name}</h2>
              <p className="text-xs font-bold text-neutral-400 mt-1">{selectedGroupMembers.length} Actieve Leden</p>
            </div>
            <button onClick={() => { setShowMembersSheet(false); setSelectedGroupMembers([]); }} className="bg-neutral-100 text-neutral-800 px-4 py-2 rounded-full text-xs font-bold">Sluiten</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {selectedGroupMembers.map(m => (
              <div key={m.user_id} className="flex items-center space-x-3 p-2.5 bg-background rounded-xl">
                <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
                  <Image src={m.avatar_url} alt="Avatar" fill className="object-cover" unoptimized />
                </div>
                <p className="text-sm font-bold text-foreground">
                  {m.full_name} {m.user_id === userId && <span className="ml-1 text-[9px] font-extrabold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Jij</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SHEET D: BEWERK GROEPSNAAM */}
      {showEditSheet && (
        <div className="fixed inset-0 z-[999] w-screen h-screen bg-neutral-900/20 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-container-bg/90 border border-white/20 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-black text-foreground">Groepsnaam Wijzigen</h2>
              <button onClick={() => setShowEditSheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            <form onSubmit={handleEditGroupName} className="space-y-4">
              <input type="text" value={editGroupNameInput} onChange={(e) => setEditGroupNameInput(e.target.value)} required className="w-full bg-background border p-3.5 rounded-xl text-xs outline-none text-foreground font-bold" />
              <button type="submit" className="w-full bg-btn-bg text-btn-text p-3.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer active:scale-98 transition">Opslaan</button>
            </form>
          </div>
        </div>
      )}

      {/* SHEET E: LEAVE CONFIRMATION */}
      {showLeaveConfirmSheet && (
        <div className="fixed inset-0 z-[999] w-screen h-screen bg-neutral-900/30 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-container-bg w-full max-w-xs rounded-2xl shadow-2xl text-center overflow-hidden">
            <div className="p-5 space-y-1">
              <h3 className="font-black text-foreground text-sm">Groep verlaten?</h3>
              <p className="text-xs text-neutral-400 leading-normal">Weet je zeker dat je geen lid meer wilt zijn van {selectedGroup?.name}?</p>
            </div>
            <div className="flex flex-col border-t border-border">
              <button onClick={() => selectedGroup && executeLeave(selectedGroup.id, false)} className="w-full py-3 text-xs font-bold text-red-500 border-b cursor-pointer">Verlaat Groep</button>
              <button onClick={() => setShowLeaveConfirmSheet(false)} className="w-full py-3 text-xs font-bold text-neutral-800 cursor-pointer">Annuleer</button>
            </div>
          </div>
        </div>
      )}

      {/* SHEET F: CRITICAL DELETE POPUP */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[999] w-screen h-screen bg-neutral-900/40 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-container-bg w-full max-w-xs rounded-2xl shadow-2xl text-center overflow-hidden">
            <div className="p-5 space-y-1">
              <h3 className="font-black text-foreground text-sm">Groep verwijderen?</h3>
              <p className="text-xs text-neutral-400 leading-normal">Je bent het laatste lid. Dit verwijdert alle agenda data permanent.</p>
            </div>
            <div className="flex flex-col border-t border-border">
              <button onClick={() => selectedGroup && executeLeave(selectedGroup.id, true)} className="w-full py-3 text-xs font-bold text-red-500 border-b cursor-pointer">Permanent Verwijderen</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="w-full py-3 text-xs font-bold text-neutral-800 cursor-pointer">Annuleer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}