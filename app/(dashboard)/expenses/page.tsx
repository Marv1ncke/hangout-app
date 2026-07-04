/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { CreditCard, Plus, ArrowRight, CheckCircle2, Archive } from "lucide-react";

export default function ExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>("");

  // Form State
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");

  // Wiskunde output
  const [balances, setBalances] = useState<{ [key: string]: number }>({});
  const [suggestedTransfers, setSuggestedTransfers] = useState<any[]>([]);

  const calculateSplitwise = useCallback((currentExpenses: any[], members: any[]) => {
    if (members.length === 0) return;

    const netBalances: { [userId: string]: number } = {};
    members.forEach(m => { netBalances[m.id] = 0; });

    currentExpenses.forEach(exp => {
      const totalAmount = parseFloat(exp.amount);
      const payer = exp.payer_id;
      const share = totalAmount / members.length;

      members.forEach(m => {
        if (m.id === payer) {
          netBalances[m.id] += (totalAmount - share);
        } else {
          netBalances[m.id] -= share;
        }
      });
    });

    setBalances(netBalances);

    // Optimalisatie-algoritme
    const debtors: { id: string; balance: number }[] = [];
    const creditors: { id: string; balance: number }[] = [];

    Object.keys(netBalances).forEach(mId => {
      const bal = netBalances[mId];
      if (bal < -0.01) debtors.push({ id: mId, balance: bal });
      else if (bal > 0.01) creditors.push({ id: mId, balance: bal });
    });

    debtors.sort((a, b) => a.balance - b.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const transfers: any[] = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amountToPay = Math.min(Math.abs(debtor.balance), creditor.balance);

      if (amountToPay > 0.01) {
        transfers.push({
          from: members.find(m => m.id === debtor.id),
          to: members.find(m => m.id === creditor.id),
          amount: amountToPay
        });
      }

      debtor.balance += amountToPay;
      creditor.balance -= amountToPay;

      if (Math.abs(debtor.balance) < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }
    setSuggestedTransfers(transfers);
  }, []);

  const loadExpensesData = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setLoading(false);
      return;
    }
    setUserId(userData.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("selected_group_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.selected_group_id) {
      setLoading(false);
      return;
    }
    const groupId = profile.selected_group_id;
    setActiveGroupId(groupId);

    // 1. Haal de GEBRUIKERS van de actieve groep op voor de selector
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id, profiles(id, full_name, avatar_url)")
      .eq("group_id", groupId)
      .eq("status", "active");

    const formattedMembers = members?.map((m: any) => m.profiles).filter(Boolean) || [];
    setGroupMembers(formattedMembers);
    
    // Zet de standaard betaler naar de ingelogde user, mits aanwezig in de groep
    if (formattedMembers.some(m => m.id === userData.user.id)) {
      setPayerId(userData.user.id);
    } else if (formattedMembers.length > 0) {
      setPayerId(formattedMembers[0].id);
    }

    // 2. Haal UITSLUITEND actieve (niet-gearchiveerde) uitgaven op
    const { data: expensesData } = await supabase
      .from("expenses")
      .select("*")
      .eq("group_id", groupId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    const currentExpenses = expensesData || [];
    setExpenses(currentExpenses);

    // 3. Wiskunde berekenen
    calculateSplitwise(currentExpenses, formattedMembers);
    setLoading(false);
  }, [calculateSplitwise]);

  useEffect(() => {
    loadExpensesData();
    
    const handleGroupChange = () => {
      loadExpensesData();
    };

    window.addEventListener("groupChanged", handleGroupChange);
    return () => window.removeEventListener("groupChanged", handleGroupChange);
  }, [loadExpensesData]);

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amount || !activeGroupId || !payerId) return;

    const { error } = await supabase.from("expenses").insert({
      group_id: activeGroupId,
      description: description.trim(),
      amount: parseFloat(amount),
      payer_id: payerId,
      is_archived: false
    });

    if (!error) {
      setDescription("");
      setAmount("");
      setShowAddSheet(false);
      loadExpensesData();
    }
  }

  async function archiveCurrentPot() {
    if (!activeGroupId || expenses.length === 0) return;
    const confirmReset = confirm("Weet je zeker dat je de huidige pot wilt afrekenen? Alle huidige uitgaven worden gearchiveerd en de balansen gaan terug naar €0.00.");
    if (!confirmReset) return;

    const { error } = await supabase
      .from("expenses")
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq("group_id", activeGroupId)
      .eq("is_archived", false);

    if (!error) {
      loadExpensesData();
    }
  }

  if (loading) return <div className="text-xs font-bold text-neutral-400">Kostenpot berekenen...</div>;

  return (
    <div className="space-y-6 select-none animate-in fade-in">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
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
            onClick={() => setShowAddSheet(true)}
            className="px-3.5 py-2 bg-black text-white text-xs font-bold rounded-xl active:scale-95 transition flex items-center gap-1"
          >
            <Plus size={14} /> Uitgave Toevoegen
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Balansen per lid */}
        <div className="bg-white border border-neutral-100 p-4 rounded-2xl space-y-3">
          <h3 className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider">Huidige Maandbalans</h3>
          <div className="space-y-2">
            {groupMembers.map((m) => {
              const bal = balances[m.id] || 0;
              return (
                <div key={m.id} className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center space-x-2">
                    <img src={m.avatar_url || "/placeholder-avatar.png"} className="w-6 h-6 rounded-full object-cover" alt={m.full_name || "Lid"} />
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
              {suggestedTransfers.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/10 p-2.5 rounded-xl text-xs font-bold">
                  <span className="truncate max-w-[90px] text-neutral-300">{t.from?.full_name?.split(" ")[0] || "Lid"}</span>
                  <div className="flex flex-col items-center mx-1 px-2 py-0.5 rounded bg-white/10 text-[9px] text-neutral-200 uppercase tracking-tight">
                    <span>betaalt €{t.amount.toFixed(2)}</span>
                    <ArrowRight size={10} className="mt-0.5" />
                  </div>
                  <span className="truncate max-w-[90px] text-white text-right">{t.to?.full_name?.split(" ")[0] || "Lid"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* GESCHIEDENIS */}
      <div className="space-y-2">
        <h2 className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider px-1">Lopende Uitgaven deze periode</h2>
        {expenses.length === 0 ? (
          <p className="text-xs font-bold text-neutral-400 p-8 bg-neutral-50 rounded-2xl border border-neutral-100 text-center">Geen openstaande kosten.</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((exp) => {
              const payer = groupMembers.find(m => m.id === exp.payer_id);
              return (
                <div key={exp.id} className="flex items-center justify-between bg-white border border-neutral-100 p-3 rounded-xl shadow-3xs">
                  <div>
                    <p className="text-xs font-black text-neutral-900">{exp.description}</p>
                    <p className="text-[10px] text-neutral-400 font-bold mt-0.5">Betaald door {payer ? payer.full_name : "Onbekend"}</p>
                  </div>
                  <span className="text-xs font-black text-neutral-950 bg-neutral-50 px-2.5 py-1.5 rounded-xl border border-neutral-100">
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
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
              <h2 className="text-xs font-black text-neutral-900">Uitgave toevoegen</h2>
              <button onClick={() => setShowAddSheet(false)} className="text-xs font-bold text-neutral-400">Sluiten</button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Beschrijving</label>
                <input type="text" placeholder="Gezamenlijke inkopen, Uber, ..." value={description} onChange={e => setDescription(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-100 p-2.5 rounded-xl text-xs outline-none font-bold" />
              </div>

              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Totaal Bedrag (€)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-black text-neutral-400">€</span>
                  <input type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required className="w-full bg-neutral-50 border border-neutral-100 pl-7 pr-4 p-2.5 rounded-xl text-xs outline-none font-black text-neutral-950" />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-extrabold uppercase text-neutral-400 px-1">Wie heeft betaald?</label>
                <select value={payerId} onChange={e => setPayerId(e.target.value)} className="w-full bg-neutral-50 border border-neutral-100 p-2.5 rounded-xl text-xs outline-none font-bold text-neutral-800">
                  {groupMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-black text-white p-3 rounded-xl text-xs font-bold active:scale-98 transition mt-2">
                Kosten splitsen 💸
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}