import Image from "next/image";
import Link from "next/link";

export default function ServiceConnections() {
  return (
    <nav aria-label="서비스 연결" className="grid grid-cols-2 gap-3 mb-6">
      {[
        { id: "vercel", name: "Vercel", description: "배포 상태" },
        { id: "supabase", name: "Supabase", description: "데이터베이스 상태" },
      ].map((service) => (
        <Link key={service.id} href={`/onboarding#${service.id}`} className="flex flex-col gap-5 rounded-[7px] border border-[var(--line)] bg-white p-5 transition-colors hover:bg-[#f4f4f5] max-[540px]:p-4">
          <Image src={`/brands/${service.id}.svg`} alt={service.name} width={140} height={28} className="h-6 w-auto max-w-full self-start object-contain object-left" />
          <span className="flex items-center justify-between gap-2 text-xs text-[#52525b]">{service.description}<span aria-label={`${service.name} 연결`}>연결 ↗</span></span>
        </Link>
      ))}
    </nav>
  );
}
