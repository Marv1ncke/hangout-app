"use client";

import React from "react";
import { HelpCircle, Calendar, Users, Clock, CreditCard } from "lucide-react";

export default function InfoPage() {
  const sections = [
    {
      title: "👥 Groepen & Werkruimtes",
      desc: "Hangout draait volledig rond actieve vriendengroepen. Je kunt een open groep aanmaken waar iedereen met de code direct kan joinen, of een gesloten/beveiligde groep waar huidige leden eerst akkoord moeten geven. Tik in je groepslijst op een kaart om direct van workspace te wisselen.",
      icon: <Users className="text-neutral-900" size={20} />
    },
    {
      title: "📅 Agenda & Hangouts",
      desc: "Dit is de centrale hub. Geplande hangouts tonen wie er aanwezig zal zijn. Je kunt optioneel locaties en dresscodes opgeven. Ieder lid kan items aan de meeneemlijst toevoegen of laten weten wat je meeneemt.",
      icon: <Calendar className="text-neutral-900" size={20} />
    },
    {
      title: "⏱️ Bezetting & Agenda matching",
      desc: "Nooit meer eindeloos overleggen in de groepschat over wanneer men kan. Leg je eigen bezette momenten vast via het dashboard. Het systeem matcht automatisch de agenda's van alle groepsleden en licht meteen op welke datums en avonden voor iedereen perfect vrij zijn.",
      icon: <Clock className="text-neutral-900" size={20} />
    },
    {
      title: "💰 De Kosten pot (Split-wise engine)",
      desc: "Geef snel uitgaven op die je voor de groep hebt gedaan (bv. drank gekocht of tickets betaald). De ingebouwde quitte-berekening verdeelt de kosten eerlijk over de actieve leden en berekent via de kortste weg wie exact hoeveel euro aan wie moet overmaken.",
      icon: <CreditCard className="text-neutral-900" size={20} />
    }
  ];

  return (
    <div className="space-y-6 select-none animate-in fade-in">
      
      {/* HEADER */}
      <div className="border-b border-neutral-100 pb-4">
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <HelpCircle size={24} strokeWidth={2.5} /> Info Hub
        </h1>
        <p className="text-xs font-bold text-neutral-400 mt-0.5">Hoe werkt de architectuur van Hangout?</p>
      </div>

      {/* SECTIONS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((sec, index) => (
          <div key={index} className="bg-neutral-50/50 border border-neutral-100 p-5 rounded-2xl space-y-3 hover:border-neutral-200 transition">
            <div className="bg-white w-9 h-9 rounded-xl flex items-center justify-center shadow-3xs">
              {sec.icon}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-neutral-900">{sec.title}</h3>
              <p className="text-xs text-neutral-500 leading-relaxed font-medium">{sec.desc}</p>
            </div>
          </div>
        ))}
      </div>



    </div>
  );
}