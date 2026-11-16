import type { Metadata } from "next";
import LevelEditor from "@/components/editor/LevelEditor";

export const metadata: Metadata = { title: "Level-Editor · Pulse" };

export default function EditorPage() {
  return <LevelEditor />;
}
