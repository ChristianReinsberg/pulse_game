import { notFound } from "next/navigation";
import GameScreen from "@/components/GameScreen";
import { LEVELS, getLevel } from "@/lib/levels";

export function generateStaticParams() {
  return LEVELS.map((l) => ({ id: String(l.id) }));
}

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const level = getLevel(Number(id));
  if (!level) notFound();
  return <GameScreen levelId={level.id} />;
}
