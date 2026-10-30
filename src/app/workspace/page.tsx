import { Workspace } from "@/components/studio/Workspace";
import { Suspense } from "react";

export const metadata = { title: "Partnership Architect · Reppl" };

export default function WorkspacePage() {
  return <Suspense fallback={<main className="studio-shell"><p className="workspace-restoring" role="status">Opening the Partnership Architect…</p></main>}><Workspace /></Suspense>;
}
