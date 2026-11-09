import Image from "next/image";

export default function ServiceIcon({ service, className = "h-5 w-5" }: { service: "vercel" | "supabase" | "chatgpt"; className?: string }) {
  return <Image src={`/brands/${service}-icon.svg`} alt="" aria-hidden="true" width={24} height={24} className={`shrink-0 object-contain ${className}`} />;
}
