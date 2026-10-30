import Link from "next/link";
import Logo from "./Logo";

export default function SiteHeader() {
  return (
    <>
      <div
        className="h-2.5 w-full sm:h-3"
        style={{
          backgroundImage: "url('/images/houndstooth.webp')",
          backgroundSize: "68px 68px",
        }}
        aria-hidden="true"
      />
      <header className="flex items-center justify-between border-b border-line px-6 py-5 sm:px-10">
        <Logo />
        <nav className="flex items-center gap-6 text-sm font-medium uppercase tracking-wide text-ink-soft">
          <Link href="/creator" className="hover:text-ink">
            Creator
          </Link>
          <Link href="/brand" className="hover:text-ink">
            Brand
          </Link>
        </nav>
      </header>
    </>
  );
}
