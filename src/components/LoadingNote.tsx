export default function LoadingNote({
  label,
  detail = "The virtual try-on usually takes 20–30 seconds per photo. Hang tight.",
}: {
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      <p className="font-serif text-lg">{label}</p>
      <p className="max-w-sm text-sm text-ink-soft">{detail}</p>
    </div>
  );
}
