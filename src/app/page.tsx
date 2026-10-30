import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center sm:px-10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
          Concept mocks for UGC pitches
        </p>
        <h1 className="mt-6 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">
          See yourself in the product before you pitch it.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-soft">
          Upload a selfie and a product photo. PitchFit shows you wearing it and writes the pitch
          — hooks, shot list, and email — so you can land the deal before you shoot a single
          frame.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/creator"
            className="bg-ink px-8 py-3 text-sm font-medium uppercase tracking-wide text-paper transition-opacity hover:opacity-90"
          >
            I&apos;m a creator
          </Link>
          <Link
            href="/brand"
            className="border border-ink px-8 py-3 text-sm font-medium uppercase tracking-wide text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            I&apos;m a brand
          </Link>
        </div>

        <div className="mt-20 grid max-w-3xl grid-cols-1 gap-8 border-t border-line pt-10 text-left sm:grid-cols-3">
          <Safeguard
            title="Always watermarked"
            body="Every mock is stamped “Concept Mock” — baked into the image, never removable."
          />
          <Safeguard
            title="Private by default"
            body="Your photos are only used to generate the mock. Nothing is posted or shared."
          />
          <Safeguard
            title="Pitch only, never final"
            body="Mocks are for landing the deal. Final content is always shot with the real product."
          />
        </div>
      </main>
    </div>
  );
}

function Safeguard({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-serif text-lg">{title}</h3>
      <p className="mt-2 text-sm text-ink-soft">{body}</p>
    </div>
  );
}
