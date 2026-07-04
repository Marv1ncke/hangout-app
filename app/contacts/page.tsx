/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { UserPlus, Check, Users, Search, X, User } from "lucide-react";

export default function ContactsPage() {
  const [userId, setUserId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  
  // Profile Modal State
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [mutualGroups, setMutualGroups] = useState<any[]>([]);

  useEffect(() => {
    loadContactsData();
  }, []);

  async function loadContactsData() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;
    const myId = userData.user.id;
    setUserId(myId);

    // 1. Geaccepteerde contacten ophalen
    const { data: accepted } = await supabase
      .from("contacts")
      .select(`
        id, status,
        sender:user_id(id, full_name, avatar_url),
        receiver:contact_id(id, full_name, avatar_url)
      `)
      .or(`user_id.eq.${myId},contact_id.eq.${myId}`)
      .eq("status", "accepted");

    const mappedContacts = accepted?.map((c: any) => 
      c.sender.id === myId ? c.receiver : c.sender
    ) || [];
    setContacts(mappedContacts);

    // 2. Inkomende vriendschapsverzoeken ophalen
    const { data: pending } = await supabase
      .from("contacts")
      .select(`id, sender:user_id(id, full_name, avatar_url)`)
      .eq("contact_id", myId)
      .eq("status", "pending");

    setPendingRequests(pending || []);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .ilike("full_name", `%${searchQuery}%`)
      .neq("id", userId)
      .limit(5);

    setSearchResults(data || []);
  }

  async function sendFriendRequest(targetId: string) {
    await supabase.from("contacts").insert({
      user_id: userId,
      contact_id: targetId,
      status: "pending"
    });
    setSearchQuery("");
    setSearchResults([]);
    alert("Vriendschapsverzoek verstuurd! 🚀");
  }

  async function acceptFriendRequest(requestId: string) {
    await supabase.from("contacts").update({ status: "accepted" }).eq("id", requestId);
    loadContactsData();
  }

  // Bekijk profiel + bereken gemeenschappelijke groepen
  async function viewProfile(profile: any) {
    setSelectedProfile(profile);

    // Haal mijn groepen op
    const { data: myGroups } = await supabase.from("group_members").select("group_id").eq("user_id", userId).eq("status", "active");
    // Haal hun groepen op
    const { data: theirGroups } = await supabase.from("group_members").select("group_id").eq("user_id", profile.id).eq("status", "active");

    if (myGroups && theirGroups) {
      const myIds = myGroups.map(g => g.group_id);
      const theirIds = theirGroups.map(g => g.group_id);
      const sharedIds = myIds.filter(id => theirIds.includes(id));

      if (sharedIds.length > 0) {
        const { data: groups } = await supabase.from("groups").select("name").in("id", sharedIds);
        setMutualGroups(groups || []);
      } else {
        setMutualGroups([]);
      }
    }
  }

  return (
    <div className="space-y-6 select-none animate-in fade-in">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Mijn Netwerk</h1>
        <p className="text-xs font-bold text-neutral-400 mt-0.5">Beheer je vrienden en bekijk hun profielen.</p>
      </div>

      {/* ZOEK BALK (SOCIAL LOOK) */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-neutral-400" size={16} />
          <input
            type="text"
            placeholder="Zoek vrienden op naam..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-100 pl-9 pr-4 py-2 rounded-xl text-xs outline-none font-medium"
          />
        </div>
        <button type="submit" className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold">Zoeken</button>
      </form>

      {/* ZOEKRESULTATEN */}
      {searchResults.length > 0 && (
        <div className="bg-neutral-50 border border-neutral-100 p-3 rounded-2xl space-y-2">
          <p className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider px-1">Resultaten</p>
          {searchResults.map((user) => (
            <div key={user.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-neutral-100">
              <div className="flex items-center space-x-2">
                <img src={user.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                <span className="text-xs font-bold text-neutral-900">{user.full_name}</span>
              </div>
              <button onClick={() => sendFriendRequest(user.id)} className="p-1.5 bg-neutral-900 text-white rounded-lg active:scale-95 transition">
                <UserPlus size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* INKOMENDE VERZOEKEN */}
      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[10px] font-extrabold uppercase text-red-500 tracking-wider px-1">Vriendschapsverzoeken 🔥</h2>
          <div className="space-y-1.5">
            {pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-neutral-50 p-3 rounded-xl border border-neutral-100/60">
                <div className="flex items-center space-x-2">
                  <img src={req.sender.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                  <span className="text-xs font-bold text-neutral-900">{req.sender.full_name}</span>
                </div>
                <button onClick={() => acceptFriendRequest(req.id)} className="flex items-center space-x-1 px-3 py-1.5 bg-black text-white rounded-lg text-xs font-bold active:scale-95 transition">
                  <Check size={12} /> <span>Accepteer</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTACTEN LIJST */}
      <div className="space-y-2">
        <h2 className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider px-1">Mijn Contacten ({contacts.length})</h2>
        {contacts.length === 0 ? (
          <p className="text-xs font-bold text-neutral-400 p-4 bg-neutral-50 rounded-xl text-center">Nog geen contacten toegevoegd.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {contacts.map((contact) => (
              <div 
                key={contact.id} 
                onClick={() => viewProfile(contact)}
                className="flex items-center space-x-3 bg-white border border-neutral-100 p-3 rounded-2xl cursor-pointer hover:border-neutral-200 transition shadow-3xs"
              >
                <img src={contact.avatar_url} className="w-10 h-10 rounded-full object-cover border border-neutral-100" alt="" />
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-neutral-900 truncate">{contact.full_name}</p>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Bekijk profiel</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* INTERACTIEF POP-UP PROFIEL (MODAL) */}
      {selectedProfile && (
        <div className="fixed inset-0 z-[999] bg-black/20 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setSelectedProfile(null)} className="absolute top-4 right-4 text-neutral-400 hover:text-black">
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center space-y-2 pt-2">
              <img src={selectedProfile.avatar_url} className="w-20 h-20 rounded-full object-cover border-2 border-neutral-100 shadow-sm" alt="" />
              <h3 className="text-sm font-black text-neutral-900">{selectedProfile.full_name}</h3>
            </div>

            <div className="border-t border-neutral-50 pt-3 space-y-2">
              <h4 className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider flex items-center gap-1">
                <Users size={12} /> Gemeenschappelijke Groepen
              </h4>
              {mutualGroups.length === 0 ? (
                <p className="text-xs font-medium text-neutral-400 italic">Geen gemeenschappelijke groepen.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {mutualGroups.map((g, i) => (
                    <span key={i} className="bg-neutral-50 text-neutral-800 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-neutral-100">
                      👥 {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}