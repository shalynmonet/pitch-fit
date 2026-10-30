"use client";

import { useRef, useState } from "react";

interface ImageDropzoneProps {
  label: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

export default function ImageDropzone({ label, hint, file, onChange }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function setFile(f: File | null) {
    onChange(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) setFile(f);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink-soft uppercase tracking-wide">{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden rounded-sm border text-left transition-colors ${
          dragOver ? "border-accent bg-accent/5" : "border-line bg-white hover:border-ink"
        }`}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={`${label} preview`} className="h-full w-full object-cover" />
            <span
              className="absolute right-2 top-2 rounded-full bg-ink/80 px-2 py-1 text-xs text-white hover:bg-ink"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Remove
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <span className="text-3xl leading-none text-ink-soft">+</span>
            <span className="text-sm text-ink-soft">Click or drag an image here</span>
            {hint && <span className="text-xs text-ink-soft/70">{hint}</span>}
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {file && <span className="truncate text-xs text-ink-soft">{file.name}</span>}
    </div>
  );
}
