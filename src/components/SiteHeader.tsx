import Link from "next/link";
import Logo from "./Logo";

export default function SiteHeader() {
  return (
    <header
      className="flex items-center justify-between px-6 py-4 sm:px-10"
      style={{
        backgroundImage: "url('/images/houndstooth.webp')",
        backgroundSize: "68px 68px",
      }}
    >
      <Logo />
      <nav className="flex items-center gap-6 text-sm font-semibold uppercase tracking-wide text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.35)]">
        <Link href="/creator" className="hover:opacity-80">
          Creator
        </Link>
        <Link href="/brand" className="hover:opacity-80">
          Brand
        </Link>
      </nav>
    </header>
  );
}
