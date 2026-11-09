import Link from "next/link";

export default function Logo({ className = "" }: { className?: string }) {
  return <Link href="/" className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${className}`} aria-label="autops home">
    <svg aria-hidden="true" viewBox="0 0 64 64" className="h-[1.35em] w-[1.35em] shrink-0">
      <rect width="64" height="64" rx="13" fill="#18181b" />
      <path d="M46 18H18v28h28V28H28v10h10" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span>autops<span className="text-[#2563eb]">.</span></span>
  </Link>;
}
