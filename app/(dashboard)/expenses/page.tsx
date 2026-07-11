/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useNavData } from "../../../hooks/useNavData";
import { useExpensesData } from "@/hooks/usePwaData";
import { Plus, ArrowRight, CheckCircle2, Archive, Trash2 } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { DragSheet } from "@/components/ui/drag-sheet";

const BOTTOM_NAV_HEIGHT = 58;
const SHEET_BOTTOM_OFFSET = `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`;

interface ExpenseRow {
  id: string;
  group_id: string;
  event_id: string | null;
  paid_by: string;
  description: string;
  amount: number;
  created_at: string;
}

export default function ExpensesPage() {
  const { data: navData } = useNavData();
  const activeGroupId = (navData as any)?.activeGroup?.id;
  const userId = (navData as any)?.profile?.id || "";

  const { members: groupMembers, expenses, mutate: mutateExpenses } = useExpensesData(activeGroupId);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(userId || "");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userId && !paidBy) setPaidBy(userId);
  }, [userId, paidBy]);

  const { balances, suggestedTransfers } = useMemo(() => {
    if (groupMembers.length === 0) return { balances: {}, suggestedTransfers: [] as any[] };

    const netBalances: { [userId: string]: number } = {};
    groupMembers.forEach((m: any) => { netBalances[m.id] = 0; });

    expenses.forEach((exp: ExpenseRow) => {
      const totalAmount = Number(exp.amount);
      const payer = exp.paid_by;
      const share = totalAmount / groupMembers.length;

      groupMembers.forEach((m: any) => {
        if (m.id === payer) netBalances[m.id] += (totalAmount - share);
        else netBalances[m.id] -= share;
      });
    });

    const debtors: { id: string; balance: number }[] = [];
    const creditors: { id: string; balance: number }[] = [];

    Object.keys(netBalances).forEach((mId) => {
      const bal = netBalances[mId];
      if (bal < -0.01) debtors.push({ id: mId, balance: bal });
      else if (bal > 0.01) creditors.push({ id: mId, balance: bal });
    });

    debtors.sort((a, b) => a.balance - b.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const transfers: any[] = [];
    let i = 0, j = 0;
    const debtorsClone = debtors.map((d) => ({ ...d }));
    const creditorsClone = creditors.map((c) => ({ ...c }));

    while (i < debtorsClone.length && j < creditorsClone.length) {
      const debtor = debtorsClone[i];
      const creditor = creditorsClone[j];
      const amountToPay = Math.min(Math.abs(debtor.balance), creditor.balance);

      if (amountToPay > 0.01) {
        transfers.push({
          from: groupMembers.find((m: any) => m.id === debtor.id),
          to: groupMembers.find((m: any) => m.id === creditor.id),
          amount: amountToPay,
        });
      }

      debtor.balance += amountToPay;
      creditor.balance -= amountToPay;
      if (Math.abs(debtor.balance) < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }

    return { balances: netBalances, suggestedTransfers: transfers };
  }, [expenses, groupMembers]);

  const allSettled = suggestedTransfers.length === 0;

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!description.trim() || !amount || !activeGroupId || !paidBy) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Vul een geldig bedrag groter dan 0 in.");
      return;
    }

    setSubmitting(true);

    const previous = expenses;
    const optimisticId = `optimistic-${Date.now()}`;
    mutateExpenses(
      (old: any) => ({
        ...old,
        expenses: [
          {
            id: optimisticId,
            group_id: activeGroupId,
            event_id: null,
            description: description.trim(),
            amount: parsedAmount,
            paid_by: paidBy,
            created_at: new Date().toISOString(),
          },
          ...(old?.expenses || []),
        ],
      }),
      false
    );

    const { error } = await supabase.from("expenses").insert({
      group_id: activeGroupId,
      description: description.trim(),
      amount: parsedAmount,
      paid_by: paidBy,
    });

    setSubmitting(false);

    if (error) {
      mutateExpenses(previous, false);
      setFormError(error.message);
      return;
    }

    setDescription("");
    setAmount("");
    setShowAddSheet(false);
    mutateExpenses();
  }

  async function handleDeleteExpense(exp: ExpenseRow) {
    if (exp.paid_by !== userId) return; // extra guard, RLS dekt dit al af
    const confirmed = window.confirm(`"${exp.description}" (€${Number(exp.amount).toFixed(2)}) verwijderen?`);
    if (!confirmed) return;

    const previous = expenses;
    mutateExpenses(
      (old: any) => old ? { ...old, expenses: old.expenses.filter((e: ExpenseRow) => e.id !== exp.id) } : old,
      false
    );

    const { error } = await supabase.from("expenses").delete().eq("id", exp.id);
    if (error) {
      mutateExpenses(previous, false);
      window.alert("Verwijderen mislukt: " + error.message);
      return;
    }
    mutateExpenses();
  }

  async function handleSettleAll() {
    if (!activeGroupId || expenses.length === 0) return;
    const confirmed = window.confirm(
      "Iedereen afrekenen? Alle huidige uitgaven van deze groep worden definitief verwijderd en de balansen gaan terug naar €0,00. Dit kan niet ongedaan gemaakt worden."
    );
    if (!confirmed) return;

    triggerHaptic(20);

    const previous = expenses;
    mutateExpenses((old: any) => ({ ...old, expenses: [] }), false);

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("group_id", activeGroupId);

    if (error) {
      mutateExpenses(previous, false);
      window.alert("Afrekenen mislukt: " + error.message);
      return;
    }
    mutateExpenses();
  }

  return (
    <div className="space-y-6 select-none animate-in fade-in max-w-2xl mx-auto pb-24">
      <div className="flex items-center justify-between border-b border-border pb-4 pt-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Budget</h1>
          <p className="text-xs font-bold text-neutral-400 mt-0.5">Wie moet wat aan wie?</p>
        </div>
        <div className="flex gap-2">
          {expenses.length > 0 && !allSettled && (
            <button
              onClick={handleSettleAll}
              className="px-3 py-2 bg-neutral-100 text-neutral-700 text-xs font-bold rounded-xl active:scale-95 transition flex items-center gap-1.5"
              title="Alles afrekenen en op nul zetten"
            >
              <Archive size={14} /> <span className="hidden sm:inline">Afrekenen</span>
            </button>
          )}
          <button
            onClick={() => { triggerHaptic(15); setShowAddSheet(true); }}
            className="px-3.5 py-2 bg-btn-bg text-btn-text text-xs font-bold rounded-xl active:scale-95 transition flex items-center gap-1"
          >
            <Plus size={14} /> Uitgave
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-container-bg border border-border p-4 rounded-2xl space-y-3">
          <h3 className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider">Huidige balans</h3>
          <div className="space-y-2">
            {groupMembers.map((m: any) => {
              const bal = balances[m.id] || 0;
              return (
                <div key={m.id} className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center space-x-2">
                    <img
                      src={m.avatar_url || "/placeholder-avatar.png"}
                      className="w-6 h-6 rounded-full object-cover"
                      alt={m.full_name || "Lid"}
                    />
                    <span className="text-foreground">{m.full_name}</span>
                  </div>
                  <span className={bal > 0 ? "text-green-500" : bal < 0 ? "text-red-500" : "text-neutral-400"}>
                    {bal > 0 ? `+ €${bal.toFixed(2)}` : bal < 0 ? `- €${Math.abs(bal).toFixed(2)}` : "Quitte"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-neutral-950 text-white p-4 rounded-2xl space-y-3 shadow-sm">
          <h3 className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider">Wie betaalt aan wie?</h3>
          {suggestedTransfers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-4 space-y-1">
              <CheckCircle2 size={24} className="text-green-400" />
              <p className="text-xs font-bold text-neutral-200">Iedereen staat quitte!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {suggestedTransfers.map((t: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-white/5 border border-white/10 p-2.5 rounded-xl text-xs font-bold"
                >
                  <span className="truncate max-w-[90px] text-neutral-300">
                    {t.from?.full_name?.split(" ")[0] || "Lid"}
                  </span>
                  <div className="flex flex-col items-center mx-1 px-2 py-0.5 rounded bg-white/10 text-[9px] text-neutral-200 uppercase tracking-tight">
                    <span>betaalt €{t.amount.toFixed(2)}</span>
                    <ArrowRight size={10} className="mt-0.5" />
                  </div>
                  <span className="truncate max-w-[90px] text-white text-right">
                    {t.to?.full_name?.split(" ")[0] || "Lid"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider px-1">
          Uitgaven
        </h2>
        {expenses.length === 0 ? (
          <p className="text-xs font-bold text-neutral-400 p-8 bg-background rounded-2xl border border-border text-center">
            Geen openstaande kosten.
          </p>
        ) : (
          <div className="space-y-2">
            {expenses.map((exp: ExpenseRow) => {
              const payer = groupMembers.find((m: any) => m.id === exp.paid_by);
              const isMine = exp.paid_by === userId;
              return (
                <div
                  key={exp.id}
                  className="flex items-center justify-between bg-container-bg border border-border p-3 rounded-xl"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground truncate">{exp.description}</p>
                    <p className="text-[10px] text-neutral-400 font-bold mt-0.5">
                      Betaald door {payer ? payer.full_name : "Onbekend"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black text-foreground bg-background px-2.5 py-1.5 rounded-xl border border-border">
                      €{Number(exp.amount).toFixed(2)}
                    </span>
                    {isMine && (
                      <button
                        onClick={() => handleDeleteExpense(exp)}
                        aria-label="Verwijder uitgave"
                        className="w-8 h-8 flex items-center justify-center text-destructive bg-destructive/10 rounded-lg active:scale-90 transition-transform"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DragSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title="Uitgave toevoegen"
        bottomOffset={SHEET_BOTTOM_OFFSET}
      >
        <form onSubmit={handleAddExpense} className="p-4 space-y-3">
          <div>
            <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Beschrijving</label>
            <input
              type="text"
              placeholder="Gezamenlijke inkopen, Uber, ..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full bg-background border border-border p-2.5 rounded-xl text-xs outline-none font-bold mt-1"
            />
          </div>

          <div>
            <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Totaal bedrag (€)</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-400">€</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-background border border-border pl-7 pr-4 p-2.5 rounded-xl text-xs outline-none font-black text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Wie heeft betaald?</label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full bg-background border border-border p-2.5 rounded-xl text-xs outline-none font-bold text-foreground mt-1"
            >
              {groupMembers.map((m: any) => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>

          {formError && <p className="text-xs text-destructive font-medium">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-btn-bg text-btn-text p-3 rounded-xl text-xs font-bold active:scale-98 transition mt-2 disabled:opacity-50"
          >
            {submitting ? "Bezig..." : "Kosten splitsen 💸"}
          </button>
        </form>
      </DragSheet>
    </div>
  );
}