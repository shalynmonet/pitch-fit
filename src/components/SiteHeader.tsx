import Link from "next/link";
import Logo from "./Logo";

export default function SiteHeader() {
  return (
    <header
      className="flex items-center justify-between px-6 py-4 sm:px-10"
      style={{
        backgroundImage: "url('/images/houndstooth.webp')",
        backgroundRepeat: "repeat",
      }}
    >
      <Logo />
      <nav className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wide">
        <Link
          href="/creator"
          className="rounded-full bg-paper px-4 py-2 text-accent shadow-sm transition-opacity hover:opacity-80"
        >
          Creator
        </Link>
        <Link
          href="/brand"
          className="rounded-full bg-paper px-4 py-2 text-accent shadow-sm transition-opacity hover:opacity-80"
        >
          Brand
        </Link>
      </nav>
    </header>
  );
}
