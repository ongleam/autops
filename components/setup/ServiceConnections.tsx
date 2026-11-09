import Image from "next/image";
import Link from "next/link";

export default function ServiceConnections() {
  return (
    <nav aria-label="Service connections" className="grid grid-cols-2 gap-2 mb-3">
      {[
        { id: "vercel", name: "Vercel" },
        { id: "supabase", name: "Supabase" },
      ].map((service) => (
        <Link key={service.id} href={`/onboarding#${service.id}`} className="flex items-center justify-between gap-2 rounded-[7px] border border-[var(--line)] bg-white p-3 transition-colors hover:bg-[#f4f4f5] ">
          <Image src={`/brands/${service.id}.svg`} alt={service.name} width={140} height={28} className="h-5 w-auto max-w-full self-start object-contain object-left" />
          <span className="shrink-0 text-xs text-[#52525b]" aria-label={`${service.name} connection`}>Connect</span>
        </Link>
      ))}
    </nav>
  );
}
