import Link from "next/link";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 100 60" className="h-7 w-auto sm:h-8" aria-hidden="true">
        <defs>
          <pattern
            id="houndstooth-logo"
            patternUnits="userSpaceOnUse"
            width="34"
            height="34"
          >
            <image href="/images/houndstooth.webp" width="34" height="34" />
          </pattern>
        </defs>
        <path
          d="M43 12 A7 7 0 1 1 57 12 M50 14 L50 22 M50 22 L90 46 M50 22 L10 46"
          fill="none"
          stroke="url(#houndstooth-logo)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="flex items-baseline text-2xl font-black tracking-tight sm:text-[1.7rem]">
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage: "url('/images/houndstooth.webp')",
            backgroundSize: "68px 68px",
          }}
        >
          PITCH
        </span>
        <span className="text-accent">FIT</span>
      </span>
    </Link>
  );
}
