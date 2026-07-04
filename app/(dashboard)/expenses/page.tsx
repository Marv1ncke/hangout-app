/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Plus, Trash2, ArrowRight } from "lucide-react";

export default function ExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("");
  const [members, setMembers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  // Form states
  const [showCreate, setShowCreate] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");

  const [debts, setDebts] = useState<any[]>([]);

  useEffect(() => {
    async function loadInitialGroupAndUser() {
      try {
        const { data: ud } = await supabase.auth.getUser();
        if (!ud?.user) return;
        setUserId(ud.user.id);
        setPaidBy(ud.user.id);

        // Haal direct de centraal opgeslagen groep op van deze gebruiker!
        const { data: profile } = await supabase
          .from("profiles")
          .select("selected_group_id")
          .eq("id", ud.user.id)
          .maybeSingle();

        if (profile?.selected_group_id) {
          setGroupId(profile.selected_group_id);
          
          const { data: gDet } = await supabase
            .from("groups")
            .select("name")
            .eq("id", profile.selected_group_id)
            .maybeSingle();
          if (gDet) setGroupName(gDet.name);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadInitialGroupAndUser();
  }, []);

  useEffect(() => {
    if (groupId) loadExpensesData();
  }, [groupId]);

  async function loadExpensesData() {
    if (!groupId) return;
    try {
      setLoading(true);

      const { data: mems } = await supabase
        .from("group_members")
        .select("user_id, profiles(full_name, avatar_url)")
        .eq("group_id", groupId)
        .eq("status", "active");

      const formattedMembers = (mems || []).map((m: any) => ({
        id: m.user_id,
        name: m.profiles?.full_name || "Lid",
        avatar: m.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.user_id}`,
      }));
      setMembers(formattedMembers);

      const { data: exps } = await supabase
        .from("expenses")
        .select(`
          id, description, amount, paid_by, created_at,
          profiles:paid_by(full_name, avatar_url),
          expense_splits(user_id, amount)
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      setExpenses(exps || []);
      calculateBalances(exps || [], formattedMembers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function calculateBalances(currentExpenses: any[], groupMembers: any[]) {
    const bal: {[key: string]: number} = {};
    groupMembers.forEach(m => { bal[m.id] = 0; });

    currentExpenses.forEach(exp => {
      const payer = exp.paid_by;
      const totalAmount = parseFloat(exp.amount);
      if (bal[payer] !== undefined) bal[payer] += totalAmount;

      const splits = exp.expense_splits || [];
      splits.forEach((s: any) => {
        if (bal[s.user_id] !== undefined) bal[s.user_id] -= parseFloat(s.amount);
      });
    });

    const participants = Object.keys(bal).map(id => ({ id, balance: bal[id] }));
    const calculatedDebts: any[] = [];
    const debtors = participants.filter(p => p.balance < -0.01).sort((a,b) => a.balance - b.balance);
    const creditors = participants.filter(p => p.balance > 0.01).sort((a,b) => b.balance - a.balance);

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amountToPay = Math.min(-debtor.balance, creditor.balance);

      if (amountToPay > 0.01) {
        calculatedDebts.push({ from: debtor.id, to: creditor.id, amount: amountToPay });
      }
      debtor.balance += amountToPay;
      creditor.balance -= amountToPay;
      if (Math.abs(debtor.balance) < 0.01) i++;
      if (Math.abs(creditor.balance) < 0.01) j++;
    }
    setDebts(calculatedDebts);
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!description || isNaN(parsedAmount) || !groupId || !paidBy) return;

    const { data: newExp } = await supabase
      .from("expenses")
      .insert({ group_id: groupId, paid_by: paidBy, description, amount: parsedAmount })
      .select().single();

    if (newExp) {
      const splitAmount = parsedAmount / members.length;
      const splitInserts = members.map(m => ({ expense_id: newExp.id, user_id: m.id, amount: splitAmount }));
      await supabase.from("expense_splits").insert(splitInserts);
    }

    setDescription("");
    setAmount("");
    setShowCreate(false);
    loadExpensesData();
  }

  async function deleteExpense(id: string) {
    await supabase.from("expenses").delete().eq("id", id);
    loadExpensesData();
  }

  if (!groupId) {
    return (
      <div className="p-6 text-neutral-400 font-bold">
        Ga eerst naar de <strong>Agenda</strong> om een actieve groep te laden!
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 select-none animate-in fade-in">
      
      {/* Centrale Groep Badge */}
      <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex items-center space-x-2.5">
        <div className="w-6 h-6 rounded-lg bg-neutral-200 text-neutral-700 flex items-center justify-center text-xs font-bold">#</div>
        <span className="text-xs font-black text-neutral-800">Kosten voor groep: <span className="text-blue-600">#{groupName}</span></span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">Kosten pot</h1>
          <p className="text-xs font-bold text-neutral-400 mt-0.5">Wie schiet wat voor? Wij berekenen de rest.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-black text-white h-11 px-4 rounded-2xl flex items-center gap-2 text-sm font-bold active:scale-95 transition-all">
          <Plus size={16} strokeWidth={3} /> Uitgave
        </button>
      </div>

      {/* NETTO BALANS OVERZICHT */}
      <div className="bg-neutral-900 text-white p-5 rounded-3xl space-y-4 shadow-xl">
        <h2 className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Wie krijgt wat of betaalt terug?</h2>
        <div className="grid grid-cols-2 gap-3">
          {debts.length === 0 ? (
            <div className="col-span-2 text-xs text-neutral-400 font-bold py-2">Helemaal quitte! 🎉</div>
          ) : (
            debts.map((d, index) => {
              const fromUser = members.find(m => m.id === d.from);
              const toUser = members.find(m => m.id === d.to);
              return (
                <div key={index} className="bg-white/5 p-3.5 rounded-2xl flex flex-col justify-between space-y-2 border border-white/5">
                  <div className="flex items-center justify-between">
                    <img src={fromUser?.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                    <ArrowRight size={12} className="text-neutral-500" />
                    <img src={toUser?.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                  </div>
                  <div className="text-[11px] font-bold truncate text-neutral-300">
                    <span className="text-white">{fromUser?.name.split(" ")[0]}</span> → {toUser?.name.split(" ")[0]}
                  </div>
                  <div className="text-base font-black text-emerald-400">€{d.amount.toFixed(2)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* HISTORIE VAN UITGAVEN */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-black text-neutral-400 uppercase tracking-wider px-1">Historie</h2>
        {loading ? (
          <div className="text-sm font-bold text-neutral-400 animate-pulse">Laden...</div>
        ) : expenses.length === 0 ? (
          <div className="bg-neutral-50 p-6 text-center text-xs font-bold text-neutral-400 rounded-2xl border border-dashed">Nog geen uitgaven.</div>
        ) : (
          expenses.map(exp => (
            <div key={exp.id} className="bg-white border border-neutral-100 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-3xs">
              <div className="flex items-center space-x-3 min-w-0">
                <img src={exp.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${exp.paid_by}`} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-black text-neutral-900 truncate tracking-tight">{exp.description}</p>
                  <p className="text-[10px] font-bold text-neutral-400 mt-0.5">Betaald door {exp.profiles?.full_name.split(" ")[0]}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 shrink-0">
                <span className="text-sm font-black text-neutral-900">€{parseFloat(exp.amount).toFixed(2)}</span>
                {exp.paid_by === userId && (
                  <button onClick={() => deleteExpense(exp.id)} className="p-2 text-neutral-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* SLIDE OVER */}
      {showCreate && (
        <div className="fixed inset-0 z-[9999] bg-white p-6 flex flex-col justify-between animate-in slide-in-from-bottom duration-300">
          <div className="space-y-6 pt-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-neutral-900">Kosten Toevoegen</h2>
              <button onClick={() => setShowCreate(false)} className="text-xs font-bold bg-neutral-100 px-3 py-1.5 rounded-full">Sluiten</button>
            </div>
            <form onSubmit={addExpense} className="space-y-4">
              <input type="text" required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Wat is er gekocht?" className="w-full h-12 border border-neutral-200 px-4 rounded-xl text-xs font-bold focus:outline-none focus:border-black" />
              <input type="number" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Bedrag (€)" className="w-full h-12 border border-neutral-200 px-4 rounded-xl text-xs font-bold focus:outline-none focus:border-black" />
              <select value={paidBy} onChange={e=>setPaidBy(e.target.value)} className="w-full h-12 border border-neutral-200 px-4 bg-white rounded-xl text-xs font-bold focus:outline-none">
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.id === userId ? "Jijzelf" : m.name}</option>
                ))}
              </select>
              <button type="submit" className="w-full h-12 bg-black text-white font-black rounded-xl text-xs shadow-sm">Opslaan</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}