import { useState } from "react";
import ConnectionWalkthrough from "@/components/ConnectionWalkthrough";
import type { KeyProvider } from "@/storage/providerKeys";

type Props = { saved: KeyProvider[]; onSave(provider: KeyProvider): void };

export default function PreviewKeySetup({ saved, onSave }: Props) {
  const [editing, setEditing] = useState<KeyProvider | null>(null);
  return <ConnectionWalkthrough preview youtube={saved.includes("youtube")} gemini={saved.includes("gemini")}
    editing={editing} draft={editing ? "sample-key" : ""} onChange={() => {}} onEdit={setEditing}
    onSave={(provider) => { setEditing(null); onSave(provider); }} onCancel={() => setEditing(null)} />;
}
