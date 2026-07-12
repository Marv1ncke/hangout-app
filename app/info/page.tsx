"use client";

import React from "react";
import {
  Users,
  Calendar,
  CreditCard,
  Smartphone,
  Bell,
  UserCircle,
} from "lucide-react";

export default function InfoPage() {
  const steps = [
    {
      title: "Maak of join een groep",
      desc: "Ga naar Groepen en maak een nieuwe groep aan, of tik op een bestaande groep in de lijst om die actief te maken. Met een code kunnen vrienden zelf joinen.",
    },
    {
      title: "Plan je eerste activiteit",
      desc: "Ga naar Agenda en tik op Nieuw. Vul titel, datum en uur in. Locatie en dresscode zijn optioneel.",
    },
    {
      title: "Laat weten of je komt",
      desc: "Groepsleden zien de activiteit verschijnen en kiezen Ik kom of Kan niet. Die keuze kan altijd nog gewijzigd worden.",
    },
    {
      title: "Verdeel de kosten",
      desc: "Iemand betaalde iets voor de groep? Voeg de uitgave toe bij Uitgaven en de app berekent automatisch wie wat aan wie verschuldigd is.",
    },
    {
      title: "Zet de app op je beginscherm",
      desc: "Tik rechtsboven op het telefoon-icoon voor installatie-instructies. Zo open je Hangout als een echte app, zonder browserbalk.",
    },
  ];

  const sections = [
    {
      title: "Groepen",
      desc: "Elke groep heeft een eigen agenda en kostenoverzicht. Wissel van groep via de naam bovenaan. Als lid kan je de groepsnaam wijzigen, de ledenlijst bekijken, of de groep verlaten.",
      icon: <Users size={20} className="text-foreground" />,
    },
    {
      title: "Agenda",
      desc: "Bekijk activiteiten per maand of als lijst. De aanmaker van een activiteit kan die achteraf nog bewerken of verwijderen. Andere leden kiezen Ik kom of Kan niet, zichtbaar aan de gekleurde rand rond hun profielfoto.",
      icon: <Calendar size={20} className="text-foreground" />,
    },
    {
      title: "Uitgaven",
      desc: "Voeg een uitgave toe en kies hoe die verdeeld wordt: gelijk, op vast bedrag, op percentage, of op aandelen. De app berekent automatisch de kortste weg om iedereen quitte te maken.",
      icon: <CreditCard size={20} className="text-foreground" />,
    },
    {
      title: "Meldingen",
      desc: "Nieuwe activiteiten, join-verzoeken voor gesloten groepen en andere belangrijke updates verschijnen hier.",
      icon: <Bell size={20} className="text-foreground" />,
    },
    {
      title: "Profiel",
      desc: "Pas je naam en profielfoto aan. Thema en lettertype passen meteen toe, zonder apart op te slaan.",
      icon: <UserCircle size={20} className="text-foreground" />,
    },
    {
      title: "Installeren als app",
      desc: "Op iOS of Android kan je Hangout op je beginscherm zetten via het installatie-icoon rechtsboven. Dat icoon is enkel zichtbaar zolang je de app nog in de browser gebruikt.",
      icon: <Smartphone size={20} className="text-foreground" />,
    },
  ];

  return (
    <div className="space-y-8 select-none animate-in fade-in">
      {/* HEADER */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-black tracking-tight">Info & handleiding</h1>
        <p className="text-xs font-bold text-neutral-400 mt-0.5">
          Hoe Hangout werkt, in het kort.
        </p>
      </div>

      {/* NEW USER GUIDE */}
      <div className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-400 px-1">
          Aan de slag
        </h2>
        <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3 p-4 bg-container-bg">
              <span className="shrink-0 size-6 rounded-full bg-background border border-border flex items-center justify-center text-xs font-black text-foreground">
                {i + 1}
              </span>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed font-medium">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURE OVERVIEW */}
      <div className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-neutral-400 px-1">
          Overzicht
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((sec, index) => (
            <div
              key={index}
              className="bg-container-bg border border-border p-5 rounded-2xl space-y-3"
            >
              <div className="bg-background w-9 h-9 rounded-xl flex items-center justify-center border border-border">
                {sec.icon}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-foreground">{sec.title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed font-medium">{sec.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}