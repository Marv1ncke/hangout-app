/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import useSWR, { useSWRConfig } from "swr";
import { useNavData } from "@/hooks/useNavData";
import { Check, X, BellOff, Calendar } from "lucide-react";

interface JoinRequest {
  id: string; // group_members row id
  group_id: string;
  user_id: string;
  status: "pending" | "active";
  created_at: string;
  group_name: string;
  user_name: string;
  user_avatar: string;
}

interface PersonalNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  created_at: string;
}

export default function NotificationsPage() {
  const { mutate } = useSWRConfig();
  const { data: navData } = useNavData();

  const currentUserId = (navData as any)?.user?.id || null;
  const myGroupIds =
    ((navData as any)?.memberships || []).map((m: any) => m.group_id) || [];

  const [toast, setToast] = useState<string | null>(null);
  const [actingRequestIds, setActingRequestIds] = useState<string[]>([]);
  const [dismissingIds, setDismissingIds] = useState<string[]>([]);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout((showToast as any)._timer);
    (showToast as any)._timer = window.setTimeout(() => setToast(null), 3000);
  }

  // ----------------------------------------
  // A) Pending join requests for my active groups
  // ----------------------------------------
  const { data: requests = [], mutate: mutateRequests } = useSWR<JoinRequest[]>(
    myGroupIds.length > 0 ? ["user-join-requests", ...myGroupIds.sort()] : null,
    async () => {
      const { data, error } = await supabase
  .from("group_members")
  .select(`
    id,
    group_id,
    user_id,
    status,
    created_at,
    groups (
      id,
      name
    ),
    profiles:user_id (
      full_name,
      avatar_url
    )
   `)
  .in("group_id", myGroupIds)
  .eq("status", "pending")
  .order("created_at", { ascending: false });

console.log("JOIN REQUESTS RAW:", data);

      if (error) throw error;

      return (data || []).map((r: any) => ({
        id: r.id,
        group_id: r.group_id,
        user_id: r.user_id,
        status: r.status,
        created_at: r.created_at,
      
        group_name: r.groups?.name || "Onbekende groep",
      
        user_name:
          r.profiles?.full_name ||
          "Nieuw lid",
      
        user_avatar:
          r.profiles?.avatar_url ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${r.user_id}`,
      }));
    },
    {
      fallbackData: [],
      revalidateOnFocus: true,
    }
  );

  // ----------------------------------------
  // B) Personal notifications for me
  // ----------------------------------------
  const { data: personalNotifications = [], mutate: mutatePersonal } =
    useSWR<PersonalNotification[]>(
      currentUserId ? ["personal-notifications", currentUserId] : null,
      async () => {
      
        const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, type, created_at, is_read, dismissed_at")
        .eq("user_id", currentUserId)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false });

        if (error) throw error;
        return data || [];
      },
      {
        fallbackData: [],
        revalidateOnFocus: true,
      }
    );

  // ----------------------------------------
  // Approve / reject join request
  // ----------------------------------------
  async function handleJoinAction(
    requestId: string,
    approve: boolean,
    userName: string,
    groupName: string
  ) {
    if (actingRequestIds.includes(requestId)) return;
    setActingRequestIds((prev) => [...prev, requestId]);

    const previousRequests = requests;

    // optimistic remove from list
    mutateRequests(
      previousRequests.filter((r) => r.id !== requestId),
      false
    );

    try {
      if (approve) {
        const { error } = await supabase
          .from("group_members")
          .update({ status: "active" })
          .eq("id", requestId);

        if (error) throw error;

        showToast(`🎉 ${userName} is toegevoegd aan ${groupName}!`);
      } else {
        const { error } = await supabase
          .from("group_members")
          .delete()
          .eq("id", requestId);

        if (error) throw error;

        showToast(`Afgewezen: ${userName} krijgt geen toegang.`);
      }

      // nav data opnieuw ophalen zodat memberships / group-state up-to-date blijven
      await mutate("global-nav-data");
      await mutateRequests();
    } catch (error: any) {
      // rollback
      mutateRequests(previousRequests, false);
      showToast(
        approve
          ? `Kon ${userName} niet toevoegen`
          : `Kon verzoek van ${userName} niet afwijzen`
      );
    } finally {
      setActingRequestIds((prev) => prev.filter((id) => id !== requestId));
    }
  }

  // ----------------------------------------
  // Dismiss personal notification
  // ----------------------------------------
  async function handleDismissNotification(id: string) {
    if (dismissingIds.includes(id)) return;
  
    setDismissingIds((prev) => [...prev, id]);
  
    const previousNotifications = personalNotifications;
  
    mutatePersonal(
      previousNotifications.filter((n) => n.id !== id),
      false
    );
  
    try {
      const { error } = await supabase
        .from("notifications")
        .update({
          dismissed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", currentUserId);
  
      if (error) throw error;
  
      await mutatePersonal();
  
    } catch {
      mutatePersonal(previousNotifications, false);
      showToast("Kon melding niet verwijderen.");
    } finally {
      setDismissingIds((prev) =>
        prev.filter((nId) => nId !== id)
      );
    }
  }

  const totalCount = requests.length + personalNotifications.length;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24 relative select-none bg-background text-foreground">
      {toast && (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex justify-center pointer-events-none animate-in slide-in-from-bottom-4">
          <div className="bg-neutral-900 text-white font-bold text-xs px-5 py-3.5 rounded-2xl shadow-2xl tracking-tight pointer-events-auto">
            {toast}
          </div>
        </div>
      )}

      <div className="border-b border-border pb-5">
        <h1 className="text-3xl font-black tracking-tight">Activiteit</h1>
        <p className="text-sm text-neutral-400 font-bold mt-0.5">
          Beheer verzoeken en meldingen.
        </p>
      </div>

      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 bg-container-bg rounded-3xl border border-border space-y-3">
          <div className="w-12 h-12 bg-background rounded-2xl flex items-center justify-center shadow-3xs text-neutral-400 border border-border">
            <BellOff size={22} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">
              Helemaal up-to-date
            </p>
            <p className="text-xs text-neutral-400 font-bold mt-0.5">
              Geen ongelezen meldingen of actieve verzoeken.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* DEEL 1: TOETREDINGSVERZOEKEN */}
          {requests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider px-1">
                Toetredingsverzoeken ({requests.length})
              </h2>

              <div className="space-y-2.5">
                {requests.map((req) => {
                  const isActing = actingRequestIds.includes(req.id);

                  return (
                    <div
                      key={req.id}
                      className="bg-container-bg border border-border p-4 rounded-2xl flex items-center justify-between gap-4 shadow-3xs"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 border border-border">
                          <Image
                            src={req.user_avatar}
                            alt={req.user_name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-bold tracking-tight leading-snug">
                            <span className="font-black">{req.user_name}</span>{" "}
                            wil meedoen met{" "}
                            <span className="text-blue-500 font-extrabold">
                              #{req.group_name}
                            </span>
                          </p>
                          <p className="text-[10px] text-neutral-400 font-bold mt-0.5">
                            {new Date(req.created_at).toLocaleDateString("nl-NL", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            handleJoinAction(
                              req.id,
                              false,
                              req.user_name,
                              req.group_name
                            )
                          }
                          disabled={isActing}
                          className="w-10 h-10 bg-background border border-border text-neutral-500 rounded-xl flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
                        >
                          <X size={18} />
                        </button>

                        <button
                          onClick={() =>
                            handleJoinAction(
                              req.id,
                              true,
                              req.user_name,
                              req.group_name
                            )
                          }
                          disabled={isActing}
                          className="w-10 h-10 bg-btn-bg text-btn-text rounded-xl flex items-center justify-center hover:bg-btn-hover cursor-pointer disabled:opacity-50"
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DEEL 2: PERSOONLIJKE MELDINGEN */}
          {personalNotifications.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-wider px-1">
                Meldingen ({personalNotifications.length})
              </h2>

              <div className="space-y-2.5">
                {personalNotifications.map((noti) => {
                  const isDismissing = dismissingIds.includes(noti.id);

                  return (
                    <div
                      key={noti.id}
                      className="bg-container-bg border border-border p-4 rounded-2xl flex items-center justify-between gap-4 shadow-3xs"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0 text-neutral-500">
                          {noti.type === "calendar" ? (
                            <Calendar size={20} />
                          ) : (
                            <Check size={20} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-black tracking-tight text-foreground">
                            {noti.title}
                          </p>
                          <p className="text-xs font-bold text-neutral-400 mt-0.5 leading-normal">
                            {noti.body}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDismissNotification(noti.id)}
                        disabled={isDismissing}
                        className="w-10 h-10 bg-background border border-border text-neutral-500 rounded-xl flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}