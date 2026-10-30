import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-5 sm:px-10">
      <Link href="/" className="font-serif text-2xl tracking-tight">
        Pitch<span className="text-accent">Fit</span>
      </Link>
      <nav className="flex items-center gap-6 text-sm font-medium uppercase tracking-wide text-ink-soft">
        <Link href="/creator" className="hover:text-ink">
          Creator
        </Link>
        <Link href="/brand" className="hover:text-ink">
          Brand
        </Link>
      </nav>
    </header>
  );
}
