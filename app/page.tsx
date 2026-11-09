import Link from "next/link";

export default function Home() {
  return (
    <>
      <header className="border-b border-foreground/15">
        <div className="mx-auto flex min-h-28 max-w-7xl items-center justify-between gap-4 px-5 py-6 sm:px-10 lg:px-14">
          <Link
            href="/"
            aria-label="COMPILED 해커톤 홈"
            className="group flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-8 sm:gap-4"
          >
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center bg-accent font-mono text-xl font-bold tracking-[-0.15em] transition-transform group-hover:-rotate-6 sm:size-12"
            >
              {"</>"}
            </span>
            <div>
              <h1 className="text-xl font-black leading-none tracking-[-0.06em] sm:text-3xl">
                COMPILED<span className="text-foreground/35">.</span>
              </h1>
              <p className="mt-2 font-mono text-[9px] tracking-[0.3em] text-foreground/55 sm:text-[10px]">
                HACKATHON
              </p>
            </div>
          </Link>

          <nav aria-label="주요 메뉴" className="flex items-center gap-10">
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/50 lg:block">
              Ideas into code.
            </p>
            <a
              href="https://github.com/ongleam/compiled-17"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub 저장소 (새 탭에서 열림)"
              className="flex min-h-11 items-center gap-3 rounded-full border border-foreground/20 px-4 text-xs font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 sm:px-5 sm:text-sm"
            >
              GitHub <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1" aria-label="COMPILED 해커톤" />
    </>
  );
}
