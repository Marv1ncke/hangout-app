/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
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
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  
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

  const isMounted = useRef(true);

  const showNotification = (message: string, sub?: string) => {
    setToast({ message, sub });
    setTimeout(() => {
      if (isMounted.current) setToast(null);
    }, 3500);
  };

  async function loadGroupsData() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user || !isMounted.current) return;
      
      const currentUserId = userData.user.id;
      setUserId(currentUserId);

      const storedFont = localStorage.getItem("app-custom-font");
      if (storedFont) setActiveFont(storedFont);

      // Haal de momenteel actieve groep op uit het profiel
      const { data: profile } = await supabase
        .from("profiles")
        .select("selected_group_id")
        .eq("id", currentUserId)
        .maybeSingle();
      
      if (isMounted.current) {
        setActiveGroupId(profile?.selected_group_id || null);
      }

      const { data: myMemberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", currentUserId)
        .eq("status", "active");

      if (myMemberships && myMemberships.length > 0 && isMounted.current) {
        const groupIds = myMemberships.map(m => m.group_id);
        const { data: groupsData } = await supabase
          .from("groups")
          .select("id, name, join_code, invite_code, is_protected")
          .in("id", groupIds);
        
        if (groupsData && isMounted.current) {
          setGroups(groupsData);
        }
      } else if (isMounted.current) {
        setGroups([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    isMounted.current = true;
    const timer = setTimeout(() => {
      loadGroupsData();
    }, 0);

    window.addEventListener("groupChanged", loadGroupsData);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("groupChanged", loadGroupsData);
    };
  }, []);

  async function handleSelectActiveGroup(groupId: string) {
    if (!userId) return;
    setActiveGroupId(groupId);
    await supabase.from("profiles").update({ selected_group_id: groupId }).eq("id", userId);
    window.dispatchEvent(new Event("groupChanged"));
    showNotification("Werkruimte gewisseld! ✨");
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim()) return;

    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 1. Maak de groep aan
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

    // 2. BUGFIX: Voeg de maker DIRECT toe met status 'active' in group_members zodat de ledentelling klopt
    await supabase.from("group_members").insert({
      group_id: newGroup.id,
      user_id: userId,
      status: "active"
    });

    // 3. Zet deze groep direct als actieve geselecteerde groep in het profiel
    await supabase.from("profiles").update({ selected_group_id: newGroup.id }).eq("id", userId);

    showNotification("Groep aangemaakt! 🤝", `Code: ${generatedCode}`);
    setGroupName("");
    setIsProtected(false);
    setShowCreateSheet(false);
    
    window.dispatchEvent(new Event("groupChanged"));
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
      await supabase.from("profiles").update({ selected_group_id: targetGroup.id }).eq("id", userId);
      window.dispatchEvent(new Event("groupChanged"));
    }

    setJoinCodeInput("");
    setShowJoinSheet(false);
    setLoading(true);
    await loadGroupsData();
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

    const { error } = await supabase
      .from("groups")
      .update({ name: editGroupNameInput.trim() })
      .eq("id", selectedGroup.id);

    if (!error) {
      showNotification("Groepsnaam bijgewerkt 📝");
      setShowEditSheet(false);
      window.dispatchEvent(new Event("groupChanged"));
      await loadGroupsData();
    }
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
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    await supabase.from("availability_slots").delete().eq("group_id", groupId).eq("user_id", userId);

    if (deleteEntireGroup) {
      await supabase.from("group_members").delete().eq("group_id", groupId);
      await supabase.from("availability_slots").delete().eq("group_id", groupId);
      await supabase.from("events").delete().eq("group_id", groupId);
      await supabase.from("groups").delete().eq("id", groupId);
      showNotification("Groep definitief verwijderd 🗑️");
    } else {
      showNotification("Groep verlaten 🚶‍♂️");
    }

    setShowDeleteConfirm(false);
    setShowLeaveConfirmSheet(false);
    window.dispatchEvent(new Event("groupChanged"));
    setLoading(true);
    await loadGroupsData();
  }

  if (loading) return <div className="p-6 text-sm text-neutral-400 font-medium">Groepen laden...</div>;

  return (
    <div style={{ fontFamily: activeFont }} className="space-y-8 relative min-h-screen pb-20 select-none animate-in fade-in">
      
      {/* FLOATING TOAST BANNER */}
      {toast && (
        <div className="fixed bottom-20 left-4 right-4 z-[10000] flex justify-center pointer-events-none">
          <div className="bg-neutral-900/95 border border-white/10 text-white w-full max-w-sm rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl flex items-center space-x-3 pointer-events-auto">
            <div className="bg-white/10 h-8 w-8 rounded-full flex items-center justify-center text-sm shrink-0">💬</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold tracking-tight text-neutral-50">{toast.message}</p>
              {toast.sub && <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{toast.sub}</p>}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100/60 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900">Groepen</h1>
          <p className="text-xs font-bold text-neutral-400 mt-0.5">Tik op een kaart om die groep direct te activeren.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowJoinSheet(true)} className="px-3.5 py-2 bg-neutral-100 text-neutral-800 text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer">Code Invullen</button>
          <button onClick={() => setShowCreateSheet(true)} className="px-3.5 py-2 bg-black text-white text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer">+ Nieuwe Groep</button>
        </div>
      </div>

      {/* GRID OVERZICHT MET INGEBOUWDE SELECTOR */}
      <div className="space-y-4">
        <h2 className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider px-1">Mijn Vriendengroepen ({groups.length})</h2>
        
        {groups.length === 0 ? (
          <div className="bg-neutral-50 rounded-2xl p-8 text-center border border-neutral-100/40">
            <p className="text-sm text-neutral-400 font-bold">Je bent nog geen lid van een actieve vriendengroep.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groups.map(g => {
              const isActive = g.id === activeGroupId;
              return (
                <div 
                  key={g.id} 
                  onClick={() => handleSelectActiveGroup(g.id)}
                  className={`border p-5 rounded-2xl shadow-3xs flex flex-col justify-between gap-4 transition-all cursor-pointer relative ${
                    isActive ? "bg-neutral-900 text-white border-neutral-900 shadow-md" : "bg-white border-neutral-100 hover:border-neutral-200 text-neutral-900"
                  }`}
                >
                  {/* Active Indicator Checkmark */}
                  {isActive && (
                    <div className="absolute top-4 right-4 bg-white/20 p-1 rounded-full text-white">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}

                  <div className="space-y-1 pr-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-lg tracking-tight">{g.name}</h3>
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md ${
                        isActive ? "bg-white/10 text-neutral-200" : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {g.is_protected ? "🔒 Privé" : "🔓 Open"}
                      </span>
                    </div>
                    <p className={`text-[11px] font-medium ${isActive ? "text-neutral-400" : "text-neutral-400"}`}>
                      Code: <code className={`font-mono font-bold px-1 py-0.5 rounded ${isActive ? "bg-white/10 text-white" : "bg-neutral-50 text-neutral-700"}`}>{g.join_code}</code>
                    </p>
                  </div>

                  <div className={`flex items-center justify-between w-full pt-3 border-t ${isActive ? "border-white/10" : "border-neutral-50"}`} onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      <button onClick={() => openMembersList(g)} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer ${isActive ? "bg-white/10 text-white hover:bg-white/20" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70"}`}>Leden</button>
                      <button onClick={() => { setSelectedGroup(g); setEditGroupNameInput(g.name); setShowEditSheet(true); }} className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer ${isActive ? "bg-white/10 text-white hover:bg-white/20" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70"}`}>Bewerk</button>
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
          <div className="bg-white/90 border border-white/20 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-black text-neutral-900">Groep Aanmaken</h2>
              <button onClick={() => setShowCreateSheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <input type="text" placeholder="Groepsnaam" value={groupName} onChange={(e) => setGroupName(e.target.value)} required className="w-full bg-neutral-50 border p-3.5 rounded-xl text-xs outline-none text-neutral-900 font-bold" />
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase px-1">Groepstype</label>
                <div className="bg-neutral-100 p-1 rounded-xl flex">
                  <button type="button" onClick={() => setIsProtected(false)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${!isProtected ? "bg-white text-black shadow-3xs" : "text-neutral-500"}`}>🔓 Open</button>
                  <button type="button" onClick={() => setIsProtected(true)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${isProtected ? "bg-white text-black shadow-3xs" : "text-neutral-500"}`}>🔒 Gesloten</button>
                </div>
              </div>
              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer active:scale-98 transition">Maak Groep</button>
            </form>
          </div>
        </div>
      )}

      {/* SHEET B: JOINEN VIA CODE */}
      {showJoinSheet && (
        <div className="fixed inset-0 z-[999] w-screen h-screen bg-neutral-900/20 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white/90 border border-white/20 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-black text-neutral-900">Deelnemen via Code</h2>
              <button onClick={() => setShowJoinSheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            <form onSubmit={handleJoinCodeSubmit} className="space-y-4">
              <input type="text" placeholder="CODE12" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} required className="w-full bg-neutral-50 border p-3.5 rounded-xl text-sm font-black tracking-widest text-center uppercase outline-none text-neutral-900" maxLength={6} />
              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer active:scale-98 transition">Deelnemen</button>
            </form>
          </div>
        </div>
      )}
      
      {/* SHEET C: FULL SCREEN LEDENLIJST */}
      {showMembersSheet && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="pt-12 pb-4 px-6 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
            <div>
              <h2 className="text-xl font-black text-neutral-900 tracking-tight">{selectedGroup?.name}</h2>
              <p className="text-xs font-bold text-neutral-400 mt-1">{selectedGroupMembers.length} Actieve Leden</p>
            </div>
            <button onClick={() => { setShowMembersSheet(false); setSelectedGroupMembers([]); }} className="bg-neutral-100 text-neutral-800 px-4 py-2 rounded-full text-xs font-bold">Sluiten</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {selectedGroupMembers.map(m => (
              <div key={m.user_id} className="flex items-center space-x-3 p-2.5 bg-neutral-50 rounded-xl">
                <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
                  <Image src={m.avatar_url} alt="Avatar" fill className="object-cover" unoptimized />
                </div>
                <p className="text-sm font-bold text-neutral-900">
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
          <div className="bg-white/90 border border-white/20 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-sm font-black text-neutral-900">Groepsnaam Wijzigen</h2>
              <button onClick={() => setShowEditSheet(false)} className="text-xs font-bold text-neutral-400 cursor-pointer">Annuleer</button>
            </div>
            <form onSubmit={handleEditGroupName} className="space-y-4">
              <input type="text" value={editGroupNameInput} onChange={(e) => setEditGroupNameInput(e.target.value)} required className="w-full bg-neutral-50 border p-3.5 rounded-xl text-xs outline-none text-neutral-900 font-bold" />
              <button type="submit" className="w-full bg-black text-white p-3.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer active:scale-98 transition">Opslaan</button>
            </form>
          </div>
        </div>
      )}

      {/* SHEET E: LEAVE CONFIRMATION */}
      {showLeaveConfirmSheet && (
        <div className="fixed inset-0 z-[999] w-screen h-screen bg-neutral-900/30 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-2xl shadow-2xl text-center overflow-hidden">
            <div className="p-5 space-y-1">
              <h3 className="font-black text-neutral-900 text-sm">Groep verlaten?</h3>
              <p className="text-xs text-neutral-400 leading-normal">Weet je zeker dat je geen lid meer wilt zijn van {selectedGroup?.name}?</p>
            </div>
            <div className="flex flex-col border-t border-neutral-100">
              <button onClick={() => selectedGroup && executeLeave(selectedGroup.id, false)} className="w-full py-3 text-xs font-bold text-red-500 border-b cursor-pointer">Verlaat Groep</button>
              <button onClick={() => setShowLeaveConfirmSheet(false)} className="w-full py-3 text-xs font-bold text-neutral-800 cursor-pointer">Annuleer</button>
            </div>
          </div>
        </div>
      )}

      {/* SHEET F: CRITICAL DELETE POPUP */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[999] w-screen h-screen bg-neutral-900/40 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-2xl shadow-2xl text-center overflow-hidden">
            <div className="p-5 space-y-1">
              <h3 className="font-black text-neutral-900 text-sm">Groep verwijderen?</h3>
              <p className="text-xs text-neutral-400 leading-normal">Je bent het laatste lid. Dit verwijdert alle agenda data permanent.</p>
            </div>
            <div className="flex flex-col border-t border-neutral-100">
              <button onClick={() => selectedGroup && executeLeave(selectedGroup.id, true)} className="w-full py-3 text-xs font-bold text-red-500 border-b cursor-pointer">Permanent Verwijderen</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="w-full py-3 text-xs font-bold text-neutral-800 cursor-pointer">Annuleer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}