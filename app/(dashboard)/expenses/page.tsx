/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useNavData } from "../../../hooks/useNavData";
import { useExpensesData } from "@/hooks/usePwaData";
import { CreditCard, Plus, ArrowRight, CheckCircle2, Archive, UserPlus } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

export default function ExpensesPage() {
  // 1. SYSTEM-WIDE COHERENT SHARED CACHE ACCESS
  const { data: navData } = useNavData();
  const activeGroupId = (navData as any)?.activeGroup?.id;
  const userId = (navData as any)?.profile?.id || "";

  const { members: groupMembers, expenses, mutate: mutateExpenses } = useExpensesData(activeGroupId);

  // 2. FORMS & UTILITY CONFIGURATION STATES
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState(userId || "");
  const [isContactPickerSupported, setIsContactPickerSupported] = useState(false);

  // Keep native platform integration checking isolated
  useEffect(() => {
    if (typeof window !== "undefined" && "contacts" in navigator && "ContactsManager" in window) {
      setIsContactPickerSupported(true);
    }
  }, []);

  // Sync state cleanly if defaults change during hot revalidation passes
  useEffect(() => {
    if (userId && !payerId) {
      setPayerId(userId);
    }
  }, [userId, payerId]);

  // 3. PURE MEMORY CALCULATIONS (0ms Re-renders, No Network Triggers)
  const { balances, suggestedTransfers } = useMemo(() => {
    if (groupMembers.length === 0) return { balances: {}, suggestedTransfers: [] };

    const netBalances: { [userId: string]: number } = {};
    groupMembers.forEach((m: any) => { netBalances[m.id] = 0; });

    expenses.forEach((exp: any) => {
      const totalAmount = parseFloat(exp.amount);
      const payer = exp.payer_id;
      const share = totalAmount / groupMembers.length;

      groupMembers.forEach((m: any) => {
        if (m.id === payer) {
          netBalances[m.id] += (totalAmount - share);
        } else {
          netBalances[m.id] -= share;
        }
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

  // 4. INSTANT ACTION OPTIMISTIC RECORD INJECTORS
  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amount || !activeGroupId || !payerId) return;

    const parsedAmount = parseFloat(amount);
    const newLocalExpense = {
      id: Math.random().toString(),
      group_id: activeGroupId,
      description: description.trim(),
      amount: parsedAmount,
      payer_id: payerId,
      is_archived: false,
      created_at: new Date().toISOString(),
    };

    // Update screen view immediately to zero latency
    mutateExpenses(
      (old: any) => ({
        ...old,
        expenses: [newLocalExpense, ...(old?.expenses || [])],
      }),
      false
    );

    setDescription("");
    setAmount("");
    setShowAddSheet(false);

    await supabase.from("expenses").insert({
      group_id: activeGroupId,
      description: description.trim(),
      amount: parsedAmount,
      payer_id: payerId,
      is_archived: false,
    });

    mutateExpenses();
  }

  async function handlePickContact() {
    triggerHaptic(15);
    try {
      const props = ["name"];
      const options = { multiple: false };
      const contacts = await (navigator as any).contacts.select(props, options);

      if (contacts && contacts.length > 0) {
        const pickedName = contacts[0].name?.[0];
        if (pickedName) {
          const matchedMember = groupMembers.find((m: any) =>
            m.full_name?.toLowerCase().includes(pickedName.toLowerCase())
          );
          if (matchedMember) {
            setPayerId(matchedMember.id);
          }
        }
      }
    } catch (err) {
      console.log("Contact picker cancelled or failed", err);
    }
  }

  async function archiveCurrentPot() {
    if (!activeGroupId || expenses.length === 0) return;
    const confirmReset = confirm(
      "Weet je zeker dat je de huidige pot wilt afrekenen? Alle huidige uitgaven worden gearchiveerd en de balansen gaan terug naar €0.00."
    );
    if (!confirmReset) return;

    // Flush immediately from rendering loop
    mutateExpenses((old: any) => ({ ...old, expenses: [] }), false);

    await supabase
      .from("expenses")
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq("group_id", activeGroupId)
      .eq("is_archived", false);

    mutateExpenses();
  }

  return (
    <div className="space-y-6 select-none animate-in fade-in">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Kosten Pot</h1>
          <p className="text-xs font-bold text-neutral-400 mt-0.5">Wie moet wat aan wie? Splitwise, live in je app.</p>
        </div>
        <div className="flex gap-2">
          {expenses.length > 0 && (
            <button
              onClick={archiveCurrentPot}
              className="px-3 py-2 bg-neutral-100 text-neutral-700 text-xs font-bold rounded-xl active:scale-95 transition flex items-center gap-1.5"
              title="Afrekenen en met schone lei beginnen"
            >
              <Archive size={14} /> <span className="hidden sm:inline">Alles Afrekenen</span>
            </button>
          )}
          <button
            onClick={() => {
              triggerHaptic(15);
              setShowAddSheet(true);
            }}
            className="px-3.5 py-2 bg-btn-bg text-btn-text text-xs font-bold rounded-xl active:scale-95 transition flex items-center gap-1"
          >
            <Plus size={14} /> Uitgave Toevoegen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Balansen per lid */}
        <div className="bg-container-bg border border-border p-4 rounded-2xl space-y-3">
          <h3 className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider">Huidige Maandbalans</h3>
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
                    <span className="text-neutral-800">{m.full_name}</span>
                  </div>
                  <span className={bal > 0 ? "text-green-500" : bal < 0 ? "text-red-500" : "text-neutral-400"}>
                    {bal > 0 ? `+ €${bal.toFixed(2)}` : bal < 0 ? `- €${Math.abs(bal).toFixed(2)}` : "Quitte"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transfers */}
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
                  className="flex items-center justify-between bg-container-bg/5 border border-white/10 p-2.5 rounded-xl text-xs font-bold"
                >
                  <span className="truncate max-w-[90px] text-neutral-300">
                    {t.from?.full_name?.split(" ")[0] || "Lid"}
                  </span>
                  <div className="flex flex-col items-center mx-1 px-2 py-0.5 rounded bg-container-bg/10 text-[9px] text-neutral-200 uppercase tracking-tight">
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

      {/* GESCHIEDENIS */}
      <div className="space-y-2">
        <h2 className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider px-1">
          Lopende Uitgaven deze periode
        </h2>
        {expenses.length === 0 ? (
          <p className="text-xs font-bold text-neutral-400 p-8 bg-background rounded-2xl border border-border text-center">
            Geen openstaande kosten.
          </p>
        ) : (
          <div className="space-y-2">
            {expenses.map((exp: any) => {
              const payer = groupMembers.find((m: any) => m.id === exp.payer_id);
              return (
                <div
                  key={exp.id}
                  className="flex items-center justify-between bg-container-bg border border-border p-3 rounded-xl shadow-3xs"
                >
                  <div>
                    <p className="text-xs font-black text-foreground">{exp.description}</p>
                    <p className="text-[10px] text-neutral-400 font-bold mt-0.5">
                      Betaald door {payer ? payer.full_name : "Onbekend"}
                    </p>
                  </div>
                  <span className="text-xs font-black text-neutral-950 bg-background px-2.5 py-1.5 rounded-xl border border-border">
                    €{Number(exp.amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL SHEET */}
      {showAddSheet && (
        <div className="fixed inset-0 z-[999] bg-black/20 backdrop-blur-xl flex items-end sm:items-center justify-center">
          <div className="bg-container-bg w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-xs font-black text-foreground">Uitgave toevoegen</h2>
              <button onClick={() => setShowAddSheet(false)} className="text-xs font-bold text-neutral-400">
                Sluiten
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Beschrijving</label>
                <input
                  type="text"
                  placeholder="Gezamenlijke inkopen, Uber, ..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full bg-background border border-border p-2.5 rounded-xl text-xs outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Totaal Bedrag (€)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-black text-neutral-400">€</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full bg-background border border-border pl-7 pr-4 p-2.5 rounded-xl text-xs outline-none font-black text-neutral-950"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Wie heeft betaald?</label>
                <div className="relative flex items-center">
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    className="w-full bg-background border border-border p-2.5 rounded-xl text-xs outline-none font-bold text-neutral-800 pr-10 appearance-none"
                  >
                    {groupMembers.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>

                  {isContactPickerSupported && (
                    <button
                      type="button"
                      onClick={handlePickContact}
                      className="absolute right-2 p-1.5 text-neutral-500 hover:text-foreground active:scale-90 transition"
                      title="Kies uit je iPhone/Android contacten"
                    >
                      <UserPlus size={16} />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-btn-bg text-btn-text p-3 rounded-xl text-xs font-bold active:scale-98 transition mt-2"
              >
                Kosten splitsen 💸
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}