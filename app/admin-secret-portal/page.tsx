"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AdminSecretPortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Hardcoded studenten-admin wachtwoord
  const ADMIN_PASSWORD = "SuperGeheimInformaticaStudentenWachtwoord2026!";

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      fetchUsersData();
    } else {
      alert("Foutief geheim wachtwoord.");
    }
  };

  async function fetchUsersData() {
    setLoading(true);
    
    // Haal de profielen op uit de publieke tabel
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*");

    if (error) {
      alert("Fout bij ophalen data: " + error.message);
    } else {
      setUsers(profiles || []);
    }
    setLoading(false);
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-neutral-900 p-6 rounded-2xl max-w-sm w-full space-y-4 border border-neutral-800">
          <div className="text-center">
            <span className="text-2xl">⚡</span>
            <h1 className="text-white font-bold mt-2">Dev Backoffice Gateway</h1>
            <p className="text-neutral-500 text-xs mt-1">Alleen voor project-maintainers.</p>
          </div>
          <input 
            type="password" 
            placeholder="Voer dev-wachtwoord in" 
            value={passwordInput} 
            onChange={(e) => setPasswordInput(e.target.value)} 
            className="w-full bg-btn-bg text-btn-text p-3 rounded-xl text-xs border border-neutral-800 outline-none text-center tracking-widest"
          />
          <button type="submit" className="w-full bg-container-bg text-foreground py-2.5 rounded-xl text-xs font-bold transition active:scale-95">
            Unlock Database View
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-black text-foreground">Project Master Control</h1>
            <p className="text-xs text-neutral-500 font-medium">Overzicht van alle geregistreerde studentenaccounts</p>
          </div>
          <button onClick={() => window.location.reload()} className="bg-btn-bg text-btn-text text-xs font-bold px-3 py-2 rounded-lg">
            Refresh Data
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-neutral-500">Gegevens inladen...</p>
        ) : (
          <div className="bg-container-bg rounded-2xl border border-border/60 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-background border-b border-border text-neutral-500 font-bold">
                    <th className="p-3">Avatar</th>
                    <th className="p-3">Display Name</th>
                    <th className="p-3">User ID (Auth Link)</th>
                    <th className="p-3">Aangemaakt op</th>
                    <th className="p-3">Wachtwoord Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-background/80 transition-colors">
                      <td className="p-3">
                        <img 
                          src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.id}`} 
                          className="w-7 h-7 rounded-full object-cover bg-neutral-100" 
                          alt="" 
                        />
                      </td>
                      <td className="p-3 font-bold text-neutral-800">{u.full_name || "Niet ingesteld"}</td>
                      <td className="p-3 text-neutral-400 font-mono text-[10px]">{u.id}</td>
                      <td className="p-3 text-neutral-500">
                        {u.created_at ? new Date(u.created_at).toLocaleString('nl-NL') : "Onbekend"}
                      </td>
                      <td className="p-3">
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-medium">
                          🔒 Gecrypt (Bcrypt/Hash)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}