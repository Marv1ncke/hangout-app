import { redirect } from "next/navigation";

// Geen homepage meer: rechtstreeks naar de agenda. /events doet zelf de
// auth-gate (toont "niet ingelogd" indien nodig), dus hier geen aparte
// "Loading..."-tussenscherm dat een flikkering veroorzaakt.
export default function RootPage() {
  redirect("/events");
}