/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useNavData } from "../../../hooks/useNavData";
import { useExpensesData } from "@/hooks/usePwaData";
import { Plus, ArrowRight, CheckCircle2, Archive, Trash2 } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { DragSheet } from "@/components/ui/drag-sheet";

const BOTTOM_NAV_HEIGHT = 49; // moet matchen met NavigationLayout.tsx nav-hoogte
const SHEET_BOTTOM_OFFSET = `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`;

interface ExpenseRow {
  id: string;
  group_id: string;
  event_id: string | null;
  paid_by: string;
  description: string;
  amount: number;
  created_at: string;
  expense_payers?: { user_id: string; paid_amount: number }[];
  expense_shares?: { user_id: string; share_amount: number }[];
}

type SplitMethod = "equal" | "amount" | "percentage" | "shares";

export default function ExpensesPage() {
  const { data: navData } = useNavData();
  const activeGroupId = (navData as any)?.activeGroup?.id;
  const userId = (navData as any)?.profile?.id || "";

  const { members: groupMembers, expenses, mutate: mutateExpenses } = useExpensesData(activeGroupId);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({}); // user_id -> bedrag
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal");
  const [participants, setParticipants] = useState<Record<string, boolean>>({}); // voor "equal": wie deelt mee
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({}); // voor "amount"
  const [splitPercentages, setSplitPercentages] = useState<Record<string, string>>({}); // voor "percentage"
  const [splitShares, setSplitShares] = useState<Record<string, string>>({}); // voor "shares"
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (userId && Object.keys(payerAmounts).length === 0 && groupMembers.length > 0) {
      setPayerAmounts({ [userId]: "" });
    }
    if (Object.keys(participants).length === 0 && groupMembers.length > 0) {
      const all: Record<string, boolean> = {};
      groupMembers.forEach((m: any) => { all[m.id] = true; });
      setParticipants(all);
    }
  }, [userId, groupMembers]); // eslint-disable-line react-hooks/exhaustive-deps

  const { balances, suggestedTransfers } = useMemo(() => {
    if (groupMembers.length === 0) return { balances: {}, suggestedTransfers: [] as any[] };

    const netBalances: { [userId: string]: number } = {};
    groupMembers.forEach((m: any) => { netBalances[m.id] = 0; });

    expenses.forEach((exp: ExpenseRow) => {
      const totalAmount = Number(exp.amount);
      const hasSplitData = exp.expense_payers?.length && exp.expense_shares?.length;

      if (hasSplitData) {
        exp.expense_payers!.forEach((p) => {
          netBalances[p.user_id] = (netBalances[p.user_id] ?? 0) + Number(p.paid_amount);
        });
        exp.expense_shares!.forEach((s) => {
          netBalances[s.user_id] = (netBalances[s.user_id] ?? 0) - Number(s.share_amount);
        });
      } else {
        // fallback voor oudere rijen zonder shares: gelijk over alle leden
        const payer = exp.paid_by;
        const share = totalAmount / groupMembers.length;
        groupMembers.forEach((m: any) => {
          if (m.id === payer) netBalances[m.id] += (totalAmount - share);
          else netBalances[m.id] -= share;
        });
      }
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

  const parsedAmount = parseFloat(amount) || 0;

  // Herleidt, ongeacht gekozen methode, tot 1 uniform formaat:
  // { user_id: bedrag_in_euro }. Dit is wat er uiteindelijk als
  // expense_shares wordt opgeslagen -- de balansberekening hoeft dus
  // nooit te weten welke methode gebruikt werd.
  const computedShares = useMemo((): Record<string, number> => {
    const result: Record<string, number> = {};

    if (splitMethod === "equal") {
      const activeIds = groupMembers.filter((m: any) => participants[m.id]).map((m: any) => m.id);
      if (activeIds.length === 0) return result;
      const share = parsedAmount / activeIds.length;
      activeIds.forEach((id: string) => { result[id] = share; });
    }

    if (splitMethod === "amount") {
      groupMembers.forEach((m: any) => {
        const v = parseFloat(splitAmounts[m.id] || "0");
        if (v > 0) result[m.id] = v;
      });
    }

    if (splitMethod === "percentage") {
      groupMembers.forEach((m: any) => {
        const pct = parseFloat(splitPercentages[m.id] || "0");
        if (pct > 0) result[m.id] = (pct / 100) * parsedAmount;
      });
    }

    if (splitMethod === "shares") {
      const totalShares = groupMembers.reduce((sum: number, m: any) => sum + (parseFloat(splitShares[m.id] || "0")), 0);
      if (totalShares > 0) {
        groupMembers.forEach((m: any) => {
          const s = parseFloat(splitShares[m.id] || "0");
          if (s > 0) result[m.id] = (s / totalShares) * parsedAmount;
        });
      }
    }

    return result;
  }, [splitMethod, participants, splitAmounts, splitPercentages, splitShares, groupMembers, parsedAmount]);

  const sharesTotal = Object.values(computedShares).reduce((a, b) => a + b, 0);
  const sharesMatch = parsedAmount > 0 && Math.abs(sharesTotal - parsedAmount) < 0.02;

  const payersTotal = Object.values(payerAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const payersMatch = parsedAmount > 0 && Math.abs(payersTotal - parsedAmount) < 0.02;

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!description.trim() || !amount || !activeGroupId) return;

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("Vul een geldig bedrag groter dan 0 in.");
      return;
    }
    if (!payersMatch) {
      setFormError(`De betalers (€${payersTotal.toFixed(2)}) moeten samen optellen tot het totaalbedrag (€${parsedAmount.toFixed(2)}).`);
      return;
    }
    if (!sharesMatch) {
      setFormError(`De verdeling (€${sharesTotal.toFixed(2)}) moet optellen tot het totaalbedrag (€${parsedAmount.toFixed(2)}).`);
      return;
    }

    setSubmitting(true);

    const payersPayload = Object.entries(payerAmounts)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([user_id, v]) => ({ user_id, amount: Math.round(parseFloat(v) * 100) / 100 }));

    const sharesPayload = Object.entries(computedShares)
      .map(([user_id, v]) => ({ user_id, amount: Math.round(v * 100) / 100 }));

    const { error } = await supabase.rpc("create_expense_atomic", {
      p_group_id: activeGroupId,
      p_description: description.trim(),
      p_amount: parsedAmount,
      p_event_id: null,
      p_payers: payersPayload,
      p_shares: sharesPayload,
    });

    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setDescription("");
    setAmount("");
    setSplitAmounts({});
    setSplitPercentages({});
    setSplitShares({});
    setSplitMethod("equal");
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
              const payerNames = exp.expense_payers && exp.expense_payers.length > 1
                ? exp.expense_payers
                    .map((p) => groupMembers.find((m: any) => m.id === p.user_id)?.full_name)
                    .filter(Boolean)
                    .join(", ")
                : payer?.full_name ?? "Onbekend";
              return (
                <div
                  key={exp.id}
                  className="flex items-center justify-between bg-container-bg border border-border p-3 rounded-xl"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground truncate">{exp.description}</p>
                    <p className="text-[10px] text-neutral-400 font-bold mt-0.5 truncate">
                      Betaald door {payerNames}
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
        className="max-h-[85dvh]"
      >
        <form onSubmit={handleAddExpense} className="p-4 space-y-4">
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

          {/* BETALERS: meerdere personen kunnen samen betaald hebben */}
          <div>
            <div className="flex items-center justify-between px-1">
              <label className="text-[9px] font-extrabold uppercase text-neutral-400">Wie betaalde?</label>
              <span className={`text-[9px] font-bold ${payersMatch ? "text-green-500" : "text-neutral-400"}`}>
                €{payersTotal.toFixed(2)} / €{parsedAmount.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1.5 mt-1">
              {groupMembers.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex-1 truncate">{m.full_name}</span>
                  <div className="relative w-24">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-400">€</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={payerAmounts[m.id] ?? ""}
                      onChange={(e) => setPayerAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      className="w-full bg-background border border-border pl-6 pr-2 py-1.5 rounded-lg text-xs font-bold text-foreground outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SPLIT-METHODE */}
          <div>
            <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Hoe verdelen?</label>
            <div className="grid grid-cols-4 gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl mt-1">
              {([
                ["equal", "Gelijk"],
                ["amount", "Bedrag"],
                ["percentage", "%"],
                ["shares", "Aandelen"],
              ] as [SplitMethod, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSplitMethod(key)}
                  className={`py-1.5 text-[10px] font-bold rounded-lg transition ${
                    splitMethod === key ? "bg-container-bg text-foreground shadow-sm" : "text-neutral-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 mt-2">
              {splitMethod === "equal" && groupMembers.map((m: any) => (
                <label key={m.id} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={!!participants[m.id]}
                    onChange={(e) => setParticipants((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                    className="size-4 accent-btn-bg"
                  />
                  <span className="text-xs font-bold text-foreground flex-1">{m.full_name}</span>
                  {computedShares[m.id] > 0 && (
                    <span className="text-[10px] font-bold text-neutral-400">€{computedShares[m.id].toFixed(2)}</span>
                  )}
                </label>
              ))}

              {splitMethod === "amount" && groupMembers.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex-1 truncate">{m.full_name}</span>
                  <div className="relative w-24">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-400">€</span>
                    <input
                      type="number" step="0.01" min="0" placeholder="0.00"
                      value={splitAmounts[m.id] ?? ""}
                      onChange={(e) => setSplitAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      className="w-full bg-background border border-border pl-6 pr-2 py-1.5 rounded-lg text-xs font-bold text-foreground outline-none"
                    />
                  </div>
                </div>
              ))}

              {splitMethod === "percentage" && groupMembers.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex-1 truncate">{m.full_name}</span>
                  <div className="relative w-20">
                    <input
                      type="number" step="1" min="0" max="100" placeholder="0"
                      value={splitPercentages[m.id] ?? ""}
                      onChange={(e) => setSplitPercentages((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      className="w-full bg-background border border-border pl-2 pr-6 py-1.5 rounded-lg text-xs font-bold text-foreground outline-none"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-neutral-400">%</span>
                  </div>
                </div>
              ))}

              {splitMethod === "shares" && groupMembers.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex-1 truncate">{m.full_name}</span>
                  <input
                    type="number" step="1" min="0" placeholder="0"
                    value={splitShares[m.id] ?? ""}
                    onChange={(e) => setSplitShares((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    className="w-20 bg-background border border-border px-2 py-1.5 rounded-lg text-xs font-bold text-foreground outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-1 mt-2">
              <span className="text-[9px] font-extrabold uppercase text-neutral-400">Verdeling</span>
              <span className={`text-[9px] font-bold ${sharesMatch ? "text-green-500" : "text-neutral-400"}`}>
                €{sharesTotal.toFixed(2)} / €{parsedAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {formError && <p className="text-xs text-destructive font-medium">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-btn-bg text-btn-text p-3 rounded-xl text-xs font-bold active:scale-98 transition mt-2 disabled:opacity-50"
          >
            {submitting ? "Bezig..." : "Kosten splitsen"}
          </button>
        </form>
      </DragSheet>
    </div>
  );
}