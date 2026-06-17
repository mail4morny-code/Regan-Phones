import { redirect } from "next/navigation";

export default function Home() {
  // Mobile-first app: dashboard is the main entry for authenticated users.
  redirect("/dashboard");
}

