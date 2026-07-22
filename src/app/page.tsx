import { redirect } from "next/navigation"

// Where the QR on the parcel lands. Sign-in first: /login already links to
// /register for new customers, and middleware bounces a live session straight
// to /dashboard, so a returning member never sees this form at all.
export default function Home() {
  redirect("/login")
}
