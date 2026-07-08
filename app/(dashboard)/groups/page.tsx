/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import { useNavData } from "../../../hooks/useNavData";
import { mutate } from "swr";
import { Check, Share2, Copy, Users, Pencil, LogOut, X } from "lucide-react";
import { useGroupMembers } from "../../../hooks/useNavData"; 

interface Group {
  id: string;
  name: string;
  join_code: string;
  invite_code: string;
  is_protected: boolean;
  created_by?: string | null;
}

interface GroupMemberDetail {
  user_id: string;
  full_name: string;
  avatar_url: string;
}

export default function GroupsPage() {
  const { data: navData, mutate: mutateNav } = useNavData();

  // Selection state (naar boven verplaatst om bruikbaar te zijn in useGroupMembers hook)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Slimme SWR-cache hook voor groepsleden gekoppeld aan de geselecteerde groep
  const { data: cachedGroupMembers = [] } = useGroupMembers(selectedGroup?.id);
  
  const activeGroupId = (navData as any)?.activeGroup?.id || null;

  // userId komt rechtstreeks uit navData (SWR levert direct de localStorage-cache,
  // dus dit is bij een warme cache al gevuld op de allereerste render — geen aparte
  // fetch/useState/useEffect race meer nodig).
  const userId = navData?.user?.id ?? "";
  // isAuthLoading is losgekoppeld van userId zelf: knoppen mogen pas "niet ingelogd"
  // tonen zodra we zeker weten dat SWR klaar is (niet tijdens de initiële fetch).
  const isAuthLoading = navData === undefined;

  const groups = ((navData as any)?.groups || []) as Group[];

  const [isPending, startTransition] = useTransition();

  // UI
  const [activeFont, setActiveFont] = useState("inherit");
  const [toast, setToast] = useState<{ message: string; sub?: string } | null>(null);

  // Sheets / dialogs
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  const [showMembersSheet, setShowMembersSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showLeaveConfirmSheet, setShowLeaveConfirmSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [closingSheet, setClosingSheet] = useState(false);

  function closeSheet(setter: React.Dispatch<React.SetStateAction<boolean>>) {
    setClosingSheet(true);
  
    setTimeout(() => {
      setter(false);
      setClosingSheet(false);
    }, 280);
  }

  // Form state
  const [groupName, setGroupName] = useState("");
  const [isProtected, setIsProtected] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [editGroupNameInput, setEditGroupNameInput] = useState("");

  // Volledig gevulde state die we synchroniseren met de SWR-cache data
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<GroupMemberDetail[]>([]);

  // Synchroniseer geselecteerde leden direct zodra de cache binnenkomt of verandert
  useEffect(() => {
    if (cachedGroupMembers && cachedGroupMembers.length > 0) {
      setSelectedGroupMembers(cachedGroupMembers);
    }
  }, [cachedGroupMembers]);

  const BOTTOM_NAV_HEIGHT = 58;
  const SHEET_BOTTOM_OFFSET = `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`;

  function showNotification(message: string, sub?: string) {
    setToast({ message, sub });
    window.clearTimeout((showNotification as any)._timer);
    (showNotification as any)._timer = window.setTimeout(() => {
      setToast(null);
    }, 3500);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedFont = localStorage.getItem("app-custom-font");
      if (storedFont) setActiveFont(storedFont);
    }
  }, []);

  useEffect(() => {
    async function updateAppBadge() {
      if (
        typeof navigator === "undefined" ||
        !("setAppBadge" in navigator)
      ) {
        return;
      }
  
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
  
      if (!user) return;
  
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
  
      if (error) {
        console.error("Badge update failed:", error.message);
        return;
      }
  
      if ((count || 0) > 0) {
        await navigator.setAppBadge(count || 0);
      } else {
        await navigator.clearAppBadge();
      }
    }
  
    updateAppBadge();
  }, []);

  const groupCount = useMemo(() => groups.length, [groups]);

  // ----------------------------------------
  // Helpers
  // ----------------------------------------
  function makeJoinCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function closeAllTransientSheets() {
    setShowCreateSheet(false);
    setShowJoinSheet(false);
    setShowEditSheet(false);
    setShowLeaveConfirmSheet(false);
    setShowDeleteConfirm(false);
  }

  async function forceNavRefresh() {
    await mutateNav();
  }

  // ----------------------------------------
  // Active group switch
  // ----------------------------------------
  async function handleSelectActiveGroup(groupId: string) {
    if (!userId || !groupId || groupId === activeGroupId) return;

    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return;

    mutateNav(
      (old: any) => ({
        ...old,
        activeGroup: targetGroup,
        profile: old?.profile
          ? { ...old.profile, selected_group_id: groupId }
          : old?.profile,
      }),
      false
    );

    showNotification("Werkruimte gewisseld ✨");

    const { error } = await supabase
      .from("profiles")
      .update({ selected_group_id: groupId })
      .eq("id", userId);

    if (error) {
      showNotification("Kon groep niet activeren", error.message);
    }

    await mutateNav();
    mutate((key) => Array.isArray(key) && key.includes(groupId));
  }

  // ----------------------------------------
  // Create group
  // ----------------------------------------
  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = groupName.trim();
    if (!trimmedName || !userId) return;

    const generatedCode = makeJoinCode();

    const optimisticGroup: Group = {
      id: `temp-${Math.random().toString(36).slice(2)}`,
      name: trimmedName,
      join_code: generatedCode,
      invite_code: generatedCode,
      is_protected: isProtected,
      created_by: userId,
    };

    mutateNav(
      (old: any) => ({
        ...old,
        groups: [...(old?.groups || []), optimisticGroup],
        activeGroup: optimisticGroup,
        profile: old?.profile
          ? { ...old.profile, selected_group_id: optimisticGroup.id }
          : old?.profile,
      }),
      false
    );

    showNotification("Groep aangemaakt", `Code: ${generatedCode}`);

    setGroupName("");
    setIsProtected(false);
    setShowCreateSheet(false);

    // Eén atomaire RPC: insert group + insert member + update profile gebeuren
    // nu allemaal in dezelfde DB-transactie. Geen race condition meer waarbij
    // een groep met 0 leden kan ontstaan.
    const { data: createdGroup, error: rpcError } = await supabase.rpc(
      "create_group_atomic",
      {
        p_name: trimmedName,
        p_join_code: generatedCode,
        p_is_protected: isProtected,
      }
    );

    if (rpcError || !createdGroup) {
      showNotification("Fout bij aanmaken", rpcError?.message || "Onbekende fout");
      await mutateNav();
      return;
    }

    await forceNavRefresh();
  }

  // ----------------------------------------
  // Join by code
  // ----------------------------------------
  async function handleJoinCodeSubmit(e: React.FormEvent) {
    e.preventDefault();

    const code = joinCodeInput.trim().toUpperCase();
    if (!code || !userId) return;

    // Eén atomaire RPC: zoekt de groep, controleert bestaand lidmaatschap, en
    // insert member + update profile in dezelfde transactie. De DB is hier de
    // enige bron van waarheid over "ben ik al lid" — geen dubbele check + insert
    // vanuit de client die elkaar in de weg kunnen zitten bij een dubbelklik.
    const { data: result, error: rpcError } = await supabase.rpc(
      "join_group_atomic",
      { p_join_code: code }
    );

    if (rpcError) {
      console.error("join_group_atomic error:", rpcError);
      showNotification("Code niet gevonden 🔍", rpcError.message || "Controleer de code en probeer opnieuw.");
      return;
    }

    const targetGroup = result.group as Group;
    const status = result.status as "active" | "pending";

    if (result.already_member) {
      showNotification(
        status === "pending" ? "Je verzoek staat al open 📩" : "Je zit al in deze groep"
      );
      setJoinCodeInput("");
      setShowJoinSheet(false);
      if (status === "active") await forceNavRefresh();
      return;
    }

    if (status === "pending") {
      showNotification(
        "Verzoek verzonden 📩",
        `Wacht tot leden van ${targetGroup.name} je accepteren.`
      );
      setJoinCodeInput("");
      setShowJoinSheet(false);
      return;
    }

    showNotification("Groep toegevoegd! ✨", `Je bent nu lid van ${targetGroup.name}`);
    setJoinCodeInput("");
    setShowJoinSheet(false);
    await forceNavRefresh();
  }

  // ----------------------------------------
  // Open members list (Nu aangedreven door SWR met fallback cache)
  // ----------------------------------------
  async function openMembersList(group: Group) {
    setSelectedGroup(group);
    setShowMembersSheet(true);

    // Als er al gecachte leden zijn voor dit groeps-id, laad deze dan direct flitsend in
    if (cachedGroupMembers && cachedGroupMembers.length > 0) {
      setSelectedGroupMembers(cachedGroupMembers);
      return;
    }

    // Directe live fallback mocht de cache op dit specifieke moment nog leeg zijn
    const { data: membersData, error } = await supabase
      .from("group_members")
      .select(`
        user_id,
        status,
        profiles:user_id ( full_name, avatar_url )
      `)
      .eq("group_id", group.id)
      .eq("status", "active");

    if (error) {
      showNotification("Kon leden niet ophalen", error.message);
      return;
    }

    if (membersData) {
      const formatted = membersData.map((m: any) => ({
        user_id: m.user_id,
        full_name: m.profiles?.full_name || `Lid ${String(m.user_id).slice(0, 4)}`,
        avatar_url:
          m.profiles?.avatar_url ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${m.user_id}`,
      }));
      setSelectedGroupMembers(formatted);
    }
  }

  // ----------------------------------------
  // Edit group name
  // ----------------------------------------
  async function handleEditGroupName(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedGroup) return;

    const trimmedName = editGroupNameInput.trim();
    if (!trimmedName) return;

    mutateNav(
      (old: any) => ({
        ...old,
        groups:
          old?.groups?.map((g: any) =>
            g.id === selectedGroup.id ? { ...g, name: trimmedName } : g
          ) || [],
        activeGroup:
          old?.activeGroup?.id === selectedGroup.id
            ? { ...old.activeGroup, name: trimmedName }
            : old?.activeGroup,
      }),
      false
    );

    setShowEditSheet(false);
    showNotification("Groepsnaam bijgewerkt 📝");

    const { error } = await supabase
      .from("groups")
      .update({ name: trimmedName })
      .eq("id", selectedGroup.id);

    if (error) {
      showNotification("Bijwerken mislukt", error.message);
    }

    await forceNavRefresh();
  }

  // ----------------------------------------
  // Leave / delete
  // ----------------------------------------
  async function handleLeaveGroupTrigger(group: Group) {
    setSelectedGroup(group);

    const { count, error } = await supabase
      .from("group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", group.id)
      .eq("status", "active");

    if (error) {
      showNotification("Kon groepsstatus niet controleren", error.message);
      return;
    }

    if ((count || 0) <= 1) {
      setShowDeleteConfirm(true);
    } else {
      setShowLeaveConfirmSheet(true);
    }
  }

  async function executeLeave(groupId: string, deleteEntireGroup: boolean) {
    const oldNav = navData as any;
    const oldGroups = oldNav?.groups || [];
    const remainingGroups = oldGroups.filter((g: any) => g.id !== groupId);
    const nextFallbackId = remainingGroups[0]?.id || null;
    const nextFallbackGroup =
      remainingGroups.find((g: any) => g.id === nextFallbackId) || remainingGroups[0] || null;

    // optimistic nav update
    mutateNav(
      (old: any) => ({
        ...old,
        groups: remainingGroups,
        memberships:
          old?.memberships?.filter((m: any) => m.group_id !== groupId) || [],
        activeGroup:
          old?.activeGroup?.id === groupId ? nextFallbackGroup : old?.activeGroup,
        profile: old?.profile
          ? { ...old.profile, selected_group_id: nextFallbackId }
          : old?.profile,
      }),
      false
    );

    if (deleteEntireGroup) {
      showNotification("Groep definitief verwijderd 🗑️");
    } else {
      showNotification("Groep verlaten 🚶‍♂️");
    }

    setShowDeleteConfirm(false);
    setShowLeaveConfirmSheet(false);

    // Eén atomaire RPC: verwijdert membership (of hele groep bij laatste lid,
    // met ON DELETE CASCADE voor members/events/attendance/availability) en
    // herbepaalt selected_group_id, allemaal in dezelfde transactie.
    const { error: rpcError } = await supabase.rpc("leave_group_atomic", {
      p_group_id: groupId,
    });

    if (rpcError) {
      showNotification(
        deleteEntireGroup ? "Groep verwijderen mislukte" : "Groep verlaten mislukt",
        rpcError.message
      );
    }

    await forceNavRefresh();
  }

  // ----------------------------------------
  // Share code
  // ----------------------------------------
  async function handleShareCode(group: Group) {
    const code = group.join_code;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Groep: ${group.name}`,
          text: `Join onze groep "${group.name}" met code: ${code}`,
        });
        showNotification("Uitnodiging gedeeld ✨");
        return;
      }

      await navigator.clipboard.writeText(code);
      showNotification("Code gekopieerd 📋", code);
    } catch {
      try {
        await navigator.clipboard.writeText(code);
        showNotification("Code gekopieerd 📋", code);
      } catch {
        showNotification("Kon code niet delen", code);
      }
    }
  }

  // ----------------------------------------
  // Render
  // ----------------------------------------
  return (
    <div
      style={{ fontFamily: activeFont }}
      className="space-y-8 relative min-h-screen pb-20 select-none animate-in fade-in"
    >
      {/* FLOATING TOAST */}
      {toast && (
        <div className="fixed bottom-20 left-4 right-4 z-[10000] flex justify-center pointer-events-none">
          <div className="bg-neutral-900/95 border border-white/10 text-white w-full max-w-sm rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl flex items-center space-x-3 pointer-events-auto">
            <div className="bg-container-bg/10 h-8 w-8 rounded-full flex items-center justify-center text-sm shrink-0">
              💬
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold tracking-tight text-neutral-50">
                {toast.message}
              </p>
              {toast.sub && (
                <p className="text-[10px] text-neutral-400 mt-0.5 truncate">
                  {toast.sub}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Groepen
          </h1>
          <p className="text-xs font-bold text-neutral-400 mt-0.5">
            Tik op een kaart om die groep direct te activeren.
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowJoinSheet(true)}
            className="px-3.5 py-2 bg-neutral-100 text-neutral-800 text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer"
          >
            Code invullen
          </button>
          <button
            onClick={() => setShowCreateSheet(true)}
            className="px-3.5 py-2 bg-btn-bg text-btn-text text-xs font-bold rounded-xl active:scale-95 transition cursor-pointer"
          >
            + Nieuwe groep
          </button>
        </div>
      </div>

      {/* GRID */}
      <div className="space-y-4">
        <h2 className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider px-1">
          Mijn vriendengroepen ({groupCount})
        </h2>

        {groups.length === 0 ? (
          <div className="bg-background rounded-2xl p-8 text-center border border-border/40">
            <p className="text-sm text-neutral-400 font-bold">
              Je bent nog geen lid van een actieve vriendengroep.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groups.map((g) => {
              const isActive = g.id === activeGroupId;

              return (
                <div
                  key={g.id}
                  onClick={() => handleSelectActiveGroup(g.id)}
                  className={`border p-5 rounded-2xl shadow-3xs flex flex-col justify-between gap-4 transition-all cursor-pointer relative ${
                    isActive
                      ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                      : "bg-container-bg border-border hover:border-border text-foreground"
                  }`}
                >
                  {/* active indicator */}
                  {isActive && (
                    <div className="absolute top-4 right-4 bg-container-bg/20 p-1 rounded-full text-white">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}

                  <div className="space-y-1 pr-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-lg tracking-tight">{g.name}</h3>
                      <span
                        className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md ${
                          isActive
                            ? "bg-container-bg/10 text-neutral-200"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {g.is_protected ? "🔒 Privé" : "🔓 Open"}
                      </span>
                    </div>

                    <p
                      className={`text-[11px] font-medium ${
                        isActive ? "text-neutral-300" : "text-neutral-400"
                      }`}
                    >
                      Code:{" "}
                      <code
                        className={`font-mono font-bold px-1 py-0.5 rounded ${
                          isActive
                            ? "bg-container-bg/10 text-white"
                            : "bg-background text-neutral-700"
                        }`}
                      >
                        {g.join_code}
                      </code>
                    </p>
                  </div>

                  {/* ACTION BAR */}
                  <div
                    className="flex items-center justify-between w-full pt-3 border-t border-white/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => openMembersList(g)}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer inline-flex items-center gap-1 ${
                          isActive
                            ? "bg-container-bg/10 text-white hover:bg-container-bg/20"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70"
                        }`}
                      >
                        <Users size={13} />
                        Leden
                      </button>

                      <button
                        onClick={() => {
                          setSelectedGroup(g);
                          setEditGroupNameInput(g.name);
                          setShowEditSheet(true);
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer inline-flex items-center gap-1 ${
                          isActive
                            ? "bg-container-bg/10 text-white hover:bg-container-bg/20"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70"
                        }`}
                      >
                        <Pencil size={13} />
                        Bewerk
                      </button>

                      <button
                        onClick={() => handleShareCode(g)}
                        className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition cursor-pointer inline-flex items-center gap-1 ${
                          isActive
                            ? "bg-container-bg/10 text-white hover:bg-container-bg/20"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70"
                        }`}
                      >
                        <Share2 size={13} />
                        Share
                      </button>
                    </div>

                    <button
                      onClick={() => handleLeaveGroupTrigger(g)}
                      className="text-[11px] font-bold text-red-500 hover:bg-red-50/10 px-2.5 py-1.5 rounded-xl transition cursor-pointer inline-flex items-center gap-1"
                    >
                      <LogOut size={13} />
                      Verlaat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SHEET A: CREATE GROUP */}
      {showCreateSheet && (
        <div className="fixed inset-0 z-[9000]">
          {/* backdrop */}
          <button
            aria-label="Sluit sheet"
            onClick={() => setShowCreateSheet(false)}
            className="absolute inset-0 bg-neutral-900/20 backdrop-blur-xl"
          />

          {/* sheet */}
          <div
            className="absolute left-0 right-0 bottom-0 animate-sheet-in"
            style={{
              paddingBottom: SHEET_BOTTOM_OFFSET,
            }}
          >
            <div className="bg-container-bg/95 border-t border-border rounded-t-3xl shadow-2xl px-6 pt-5 pb-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-black text-foreground">Groep aanmaken</h2>
                <button
                  onClick={() => setShowCreateSheet(false)}
                  className="text-xs font-bold text-neutral-400 cursor-pointer"
                >
                  Annuleer
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <input
                  type="text"
                  placeholder="Groepsnaam"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-background border p-3.5 rounded-xl text-xs outline-none text-foreground font-bold"
                />

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase px-1">
                    Groepstype
                  </label>
                  <div className="bg-neutral-100 p-1 rounded-xl flex">
                    <button
                      type="button"
                      onClick={() => setIsProtected(false)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                        !isProtected
                          ? "bg-container-bg text-foreground shadow-3xs"
                          : "text-neutral-500"
                      }`}
                    >
                      🔓 Open
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsProtected(true)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                        isProtected
                          ? "bg-container-bg text-foreground shadow-3xs"
                          : "text-neutral-500"
                      }`}
                    >
                      🔒 Gesloten
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!userId}
                  className="w-full bg-btn-bg text-btn-text p-3.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer active:scale-98 transition disabled:opacity-50"
                >
                  Maak groep
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SHEET B: JOIN BY CODE */}
      {showJoinSheet && (
        <div className="fixed inset-0 z-[9000]">
          {/* backdrop */}
          <button
            aria-label="Sluit sheet"
            onClick={() => setShowJoinSheet(false)}
            className="absolute inset-0 bg-neutral-900/20 backdrop-blur-xl"
          />

          {/* sheet */}
          <div
            className="absolute left-0 right-0 bottom-0 animate-sheet-in"
            style={{
              paddingBottom: SHEET_BOTTOM_OFFSET,
            }}
          >
            <div className="bg-container-bg/95 border-t border-border rounded-t-3xl shadow-2xl px-6 pt-5 pb-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-black text-foreground">Deelnemen via code</h2>
                <button
                  onClick={() => setShowJoinSheet(false)}
                  className="text-xs font-bold text-neutral-400 cursor-pointer"
                >
                  Annuleer
                </button>
              </div>

              <form onSubmit={handleJoinCodeSubmit} className="space-y-4">
                <input
                  type="text"
                  placeholder="CODE12"
                  required
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-background border p-3.5 rounded-xl text-sm font-black tracking-widest text-center uppercase outline-none text-foreground"
                />
                <button
                  type="submit"
                  disabled={!userId}
                  className="w-full bg-btn-bg text-btn-text p-3.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer active:scale-98 transition disabled:opacity-50"
                >
                  Deelnemen
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SHEET C: MEMBERS LIST */}
      {showMembersSheet && (
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          {/* backdrop */}
          <button
            aria-label="Sluit ledenlijst"
            onClick={() => setShowMembersSheet(false)}
            className="absolute inset-0 bg-neutral-900/20 backdrop-blur-xl"
          />

          {/* full-height sheet panel achter navbar */}
          <div
            className="absolute left-0 right-0 bg-container-bg rounded-t-3xl border-t border-border shadow-2xl animate-sheet-in flex flex-col overflow-hidden"
            style={{
              top: "calc(64px + env(safe-area-inset-top))",
              bottom: SHEET_BOTTOM_OFFSET,
            }}
          >
            <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between shrink-0 bg-container-bg">
              <div>
                <h2 className="text-xl font-black text-foreground tracking-tight">
                  {selectedGroup?.name}
                </h2>
                <p className="text-xs font-bold text-neutral-400 mt-1">
                  {selectedGroupMembers.length} actieve leden
                </p>
              </div>
              <button
                onClick={() => setShowMembersSheet(false)}
                aria-label="Sluiten"
                className="w-9 h-9 flex items-center justify-center bg-neutral-100 text-neutral-800 rounded-full shrink-0"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {selectedGroupMembers.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center space-x-3 p-2.5 bg-background rounded-xl"
                >
                  <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
                    <Image
                      src={m.avatar_url}
                      alt="Avatar"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    {m.full_name}
                    {m.user_id === userId && (
                      <span className="ml-1 text-[9px] font-extrabold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                        Jij
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHEET D: EDIT GROUP NAME */}
      {showEditSheet && (
        <div className="fixed inset-0 z-[9000]">
          {/* backdrop */}
          <button
            aria-label="Sluit sheet"
            onClick={() => setShowEditSheet(false)}
            className="absolute inset-0 bg-neutral-900/20 backdrop-blur-xl"
          />

          {/* sheet */}
          <div
            className="absolute left-0 right-0 bottom-0 animate-sheet-in"
            style={{
              paddingBottom: SHEET_BOTTOM_OFFSET,
            }}
          >
            <div className="bg-container-bg/95 border-t border-border rounded-t-3xl shadow-2xl px-6 pt-5 pb-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-black text-foreground">
                  Groepsnaam wijzigen
                </h2>
                <button
                  onClick={() => setShowEditSheet(false)}
                  className="text-xs font-bold text-neutral-400 cursor-pointer"
                >
                  Annuleer
                </button>
              </div>

              <form onSubmit={handleEditGroupName} className="space-y-4">
                <input
                  type="text"
                  value={editGroupNameInput}
                  onChange={(e) => setEditGroupNameInput(e.target.value)}
                  required
                  className="w-full bg-background border p-3.5 rounded-xl text-xs outline-none text-foreground font-bold"
                />
                <button
                  type="submit"
                  className="w-full bg-btn-bg text-btn-text p-3.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer active:scale-98 transition"
                >
                  Opslaan
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SHEET E: LEAVE CONFIRM */}
      {showLeaveConfirmSheet && (
        <div className="fixed top-0 bottom-20 left-0 right-0 z-[999] w-screen h-screen bg-neutral-900/30 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-container-bg w-full max-w-xs rounded-2xl shadow-2xl text-center overflow-hidden">
            <div className="p-5 space-y-1">
              <h3 className="font-black text-foreground text-sm">Groep verlaten?</h3>
              <p className="text-xs text-neutral-400 leading-normal">
                Weet je zeker dat je geen lid meer wilt zijn van{" "}
                {selectedGroup?.name}?
              </p>
            </div>
            <div className="flex flex-col border-t border-border">
              <button
                onClick={() => selectedGroup && executeLeave(selectedGroup.id, false)}
                className="w-full py-3 text-xs font-bold text-red-500 border-b cursor-pointer"
              >
                Verlaat groep
              </button>
              <button
                onClick={() => setShowLeaveConfirmSheet(false)}
                className="w-full py-3 text-xs font-bold text-neutral-800 cursor-pointer"
              >
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHEET F: DELETE LAST GROUP CONFIRM */}
      {showDeleteConfirm && (
        <div className="fixed top-0 bottom-20 left-0 right-0 z-[999] w-screen h-screen bg-neutral-900/40 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-container-bg w-full max-w-xs rounded-2xl shadow-2xl text-center overflow-hidden">
            <div className="p-5 space-y-1">
              <h3 className="font-black text-foreground text-sm">Groep verwijderen?</h3>
              <p className="text-xs text-neutral-400 leading-normal">
                Je bent het laatste lid. Dit verwijdert alle agenda data permanent.
              </p>
            </div>
            <div className="flex flex-col border-t border-border">
              <button
                onClick={() => selectedGroup && executeLeave(selectedGroup.id, true)}
                className="w-full py-3 text-xs font-bold text-red-500 border-b cursor-pointer"
              >
                Permanent verwijderen
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-3 text-xs font-bold text-neutral-800 cursor-pointer"
              >
                Annuleer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}