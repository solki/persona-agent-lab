import { SoulForm } from "@/components/souls/SoulForm";

export default function SoulDetailPage({ params }: { params: { id: string } }) {
  return <SoulForm mode="edit" soulId={Number(params.id)} />;
}
