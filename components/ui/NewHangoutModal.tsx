"use client";

import { useEffect, useState } from "react";
import { useModal } from "./useModal";
import { supabase } from "@/lib/supabase/client";
import { useGroup } from "@/components/state/useGroup";

function toInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function NewHangoutModal() {
  const { open, draft, closeModal } = useModal();
  const { groupId } = useGroup();

  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const editing = !!draft?.id;

  useEffect(() => {
    if (!open) return;

    const defaultStart = draft?.start ?? new Date();
    const defaultEnd =
      draft?.end ?? new Date(defaultStart.getTime() + 60 * 60 * 1000);

    setTitle(draft?.title ?? "");
    setStart(toInputValue(defaultStart));
    setEnd(toInputValue(defaultEnd));
  }, [open, draft]);

  async function saveEvent() {
    if (!groupId) return alert("Select a group first.");
    if (!title.trim()) return alert("Enter a title.");

    setSaving(true);

    if (editing && draft?.id) {
      const { error } = await supabase
        .from("events")
        .update({
          title: title.trim(),
          start_time: new Date(start).toISOString(),
          end_time: new Date(end).toISOString(),
        })
        .eq("id", draft.id);

      setSaving(false);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("events").insert({
        title: title.trim(),
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        group_id: groupId,
      });

      setSaving(false);
      if (error) return alert(error.message);
    }

    closeModal();
    window.dispatchEvent(new CustomEvent("hangout:event-created"));
  }

  async function deleteEvent() {
    if (!draft?.id) return;

    const ok = confirm("Delete this hangout?");
    if (!ok) return;

    const { error } = await supabase.from("events").delete().eq("id", draft.id);
    if (error) return alert(error.message);

    closeModal();
    window.dispatchEvent(new CustomEvent("hangout:event-created"));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-end md:items-center justify-center p-3">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border p-4 md:p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold">
            {editing ? "Edit hangout" : "New hangout"}
          </h2>
          <p className="text-sm text-neutral-500">
            {editing
              ? "Update or delete this event."
              : "Create a shared event for the selected group."}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <input
            className="w-full border rounded-xl p-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dinner, football, drinks..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start</label>
            <input
              type="datetime-local"
              className="w-full border rounded-xl p-3"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">End</label>
            <input
              type="datetime-local"
              className="w-full border rounded-xl p-3"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <div>
            {editing && (
              <button
                onClick={deleteEvent}
                className="px-4 py-2 rounded-xl border border-red-200 text-red-600"
              >
                Delete
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={closeModal}
              className="px-4 py-2 rounded-xl border"
            >
              Cancel
            </button>

            <button
              onClick={saveEvent}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-black text-white"
            >
              {saving ? "Saving..." : editing ? "Save changes" : "Create hangout"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}