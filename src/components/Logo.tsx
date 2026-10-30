import Link from "next/link";
import Image from "next/image";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex items-center rounded-full bg-paper px-4 py-2 shadow-sm ${className}`}
    >
      <Image
        src="/images/logo.png"
        alt="PitchFit"
        width={1209}
        height={708}
        priority
        className="h-9 w-auto sm:h-11"
      />
    </Link>
  );
}
