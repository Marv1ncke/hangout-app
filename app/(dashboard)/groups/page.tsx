"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useGroup } from "@/components/state/useGroup";

type Group = {
  id: string;
  name: string;
  invite_code: string | null;
  created_at?: string;
};

type MemberCountRow = {
  group_id: string;
};

export default function GroupsPage() {
  const { groupId, setGroup, clearGroup } = useGroup();

  const [groups, setGroups] = useState<Group[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function ensureProfile(userId: string) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("profiles").insert({
        id: userId,
      });
    }
  }

  async function loadGroups() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    await ensureProfile(user.id);

    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    const ids = (memberships || []).map((m) => m.group_id);

    if (!ids.length) {
      setGroups([]);
      setMemberCounts({});
      if (groupId) clearGroup();
      return;
    }

    const { data: groupRows } = await supabase
      .from("groups")
      .select("id, name, invite_code, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });

    setGroups(groupRows || []);

    const { data: allMembers } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", ids);

    const counts: Record<string, number> = {};
    (allMembers || []).forEach((row: MemberCountRow) => {
      counts[row.group_id] = (counts[row.group_id] || 0) + 1;
    });
    setMemberCounts(counts);

    const { data: profile } = await supabase
      .from("profiles")
      .select("selected_group_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.selected_group_id) {
      const selected = (groupRows || []).find(
        (g) => g.id === profile.selected_group_id
      );
      if (selected) {
        setGroup(selected.id, selected.name);
      }
    } else if (groupRows?.length && !groupId) {
      const first = groupRows[0];
      await supabase
        .from("profiles")
        .update({ selected_group_id: first.id, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      setGroup(first.id, first.name);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function createGroup() {
    const name = newGroupName.trim();
    if (!name) return alert("Enter a group name.");

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setLoading(false);
      return alert("You must be logged in.");
    }

    await ensureProfile(user.id);

    const inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 10);

    const { data: createdGroup, error: groupError } = await supabase
      .from("groups")
      .insert({
        name,
        created_by: user.id,
        invite_code: inviteCode,
      })
      .select("id, name, invite_code")
      .single();

    if (groupError || !createdGroup) {
      setLoading(false);
      return alert(groupError?.message || "Could not create group.");
    }

    const { error: memberError } = await supabase.from("group_members").insert({
      group_id: createdGroup.id,
      user_id: user.id,
    });

    if (memberError) {
      setLoading(false);
      return alert(memberError.message);
    }

    await supabase
      .from("profiles")
      .update({
        selected_group_id: createdGroup.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setGroup(createdGroup.id, createdGroup.name);
    setNewGroupName("");
    await loadGroups();
    setLoading(false);
  }

  async function joinGroup() {
    const code = joinCode.trim();
    if (!code) return alert("Enter an invite code.");

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setLoading(false);
      return alert("You must be logged in.");
    }

    await ensureProfile(user.id);

    const { data: foundGroup, error: findError } = await supabase
      .from("groups")
      .select("id, name, invite_code")
      .eq("invite_code", code)
      .single();

    if (findError || !foundGroup) {
      setLoading(false);
      return alert("Invalid invite code.");
    }

    const { error: memberError } = await supabase.from("group_members").upsert(
      {
        group_id: foundGroup.id,
        user_id: user.id,
      },
      { onConflict: "group_id,user_id" }
    );

    if (memberError) {
      setLoading(false);
      return alert(memberError.message);
    }

    await supabase
      .from("profiles")
      .update({
        selected_group_id: foundGroup.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setGroup(foundGroup.id, foundGroup.name);
    setJoinCode("");
    await loadGroups();
    setLoading(false);
  }

  async function openGroup(group: Group) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    await supabase
      .from("profiles")
      .update({
        selected_group_id: group.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setGroup(group.id, group.name);
  }

  async function leaveGroup(group: Group) {
    const memberCount = memberCounts[group.id] || 0;
    const confirmText =
      memberCount <= 1
        ? `Leave "${group.name}"? You are the last member, so the group will be deleted.`
        : `Leave "${group.name}"?`;

    const ok = confirm(confirmText);
    if (!ok) return;

    const { error } = await supabase.rpc("leave_group_and_cleanup", {
      p_group_id: group.id,
    });

    if (error) return alert(error.message);

    if (groupId === group.id) {
      clearGroup();
    }

    await loadGroups();
  }

  async function copyInvite(code: string | null) {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    alert("Invite code copied");
  }

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === groupId) ?? null,
    [groups, groupId]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Groups</h1>
        <p className="text-sm text-neutral-500">
          Create a friend group, join with an invite code, and manage membership.
        </p>
      </div>

      {selectedGroup && (
        <div className="rounded-2xl border bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm text-neutral-500">Current group</div>
            <div className="font-semibold text-lg">{selectedGroup.name}</div>
          </div>
          <div className="text-sm text-neutral-500">
            Members: {memberCounts[selectedGroup.id] || 1}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Create group</h2>
            <p className="text-sm text-neutral-500">
              Start a shared planning space for your friends.
            </p>
          </div>

          <input
            className="w-full rounded-xl border p-3"
            placeholder="Friday Crew"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />

          <button
            onClick={createGroup}
            disabled={loading}
            className="rounded-xl bg-black text-white px-4 py-2"
          >
            {loading ? "Working..." : "Create group"}
          </button>
        </div>

        <div className="rounded-2xl border bg-white p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Join with invite code</h2>
            <p className="text-sm text-neutral-500">
              Ask a friend for the group code and join instantly.
            </p>
          </div>

          <input
            className="w-full rounded-xl border p-3"
            placeholder="e.g. 1f9ab32cde"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />

          <button
            onClick={joinGroup}
            disabled={loading}
            className="rounded-xl border px-4 py-2"
          >
            {loading ? "Working..." : "Join group"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <div className="mb-4">
          <h2 className="font-semibold">Your groups</h2>
          <p className="text-sm text-neutral-500">
            Switch groups, share invite codes, or leave a group.
          </p>
        </div>

        <div className="space-y-3">
          {groups.length === 0 ? (
            <div className="text-sm text-neutral-500">No groups yet.</div>
          ) : (
            groups.map((group) => {
              const active = group.id === groupId;
              const members = memberCounts[group.id] || 1;

              return (
                <div
                  key={group.id}
                  className="rounded-2xl border p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >
                  <div>
                    <div className="font-medium">{group.name}</div>
                    <div className="text-sm text-neutral-500">
                      Invite code: {group.invite_code || "—"}
                    </div>
                    <div className="text-sm text-neutral-500">
                      Members: {members}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openGroup(group)}
                      className={`rounded-xl px-3 py-2 text-sm border ${
                        active ? "bg-black text-white border-black" : ""
                      }`}
                    >
                      {active ? "Opened" : "Open"}
                    </button>

                    <button
                      onClick={() => copyInvite(group.invite_code)}
                      className="rounded-xl border px-3 py-2 text-sm"
                    >
                      Copy invite
                    </button>

                    <button
                      onClick={() => leaveGroup(group)}
                      className="rounded-xl border border-red-200 text-red-600 px-3 py-2 text-sm"
                    >
                      {members <= 1 ? "Delete group" : "Leave group"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}