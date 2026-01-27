"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { InfoTooltip } from "@/components/ui/info-tooltip";

const HERO_UPLOAD_KEY = "ttl:hero-upload";

const bufferToBase64 = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export function HeroUploadCta() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragCounter = useRef(0);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setIsLoading(true);
    try {
      const dataBase64 = await bufferToBase64(file);
      const payload = {
        name: file.name,
        type: file.type || "application/octet-stream",
        dataBase64,
      };
      sessionStorage.setItem(HERO_UPLOAD_KEY, JSON.stringify(payload));
      router.push("/app/create");
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        className={`group relative w-full flex min-h-[172px] cursor-pointer flex-col items-center justify-center gap-1 rounded-3xl border border-dashed px-8 py-6 text-center text-base font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring hover:border-solid hover:shadow-[inset_0_0_8px_5px_rgba(95,185,125,0.12)] ${
          isDragging
            ? "border-success/60 text-foreground shadow-[inset_0_0_8px_5px_rgba(95,185,125,0.12)]"
            : "border-success/50 text-foreground"
        }`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!event.dataTransfer.types?.includes("Files")) return;
          dragCounter.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!event.dataTransfer.types?.includes("Files")) return;
          event.dataTransfer.dropEffect = "copy";
          setIsDragging(true);
        }}
        onDragLeave={() => {
          dragCounter.current = Math.max(0, dragCounter.current - 1);
          if (dragCounter.current === 0) setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragCounter.current = 0;
          setIsDragging(false);
          const dropped = event.dataTransfer.files?.[0] ?? null;
          void handleUpload(dropped);
        }}
      >
        <div className="absolute right-3 top-3 z-50">
          <InfoTooltip title="Nur eine Datei (*.pdf, *.txt, *.md)" />
        </div>
        <div className="flex items-center justify-center text-primary transition-transform duration-200 group-hover:-translate-y-0.5">
          <svg
            viewBox="0 0 24 24"
            className={`h-[54px] w-[54px] transition-transform duration-200 drop-shadow-[0_0_6px_var(--background)] ${
              isDragging ? "scale-110" : "group-hover:scale-110"
            }`}
            aria-hidden="true"
          >
            <g
              className={`transition-transform duration-200 ${
                isDragging ? "-translate-y-[3px] -rotate-8 -skew-x-6" : "translate-y-0 rotate-0"
              }`}
              style={{ transformOrigin: "4px 9px" }}
            >
              <path d="M3 9h12.2l2.2 3H3z" fill="currentColor" />
            </g>
            <g
              className={`transition-all duration-200 ${
                isDragging ? "opacity-100 -translate-y-1" : "opacity-0 translate-y-0.5"
              }`}
            >
              <rect x="4.1" y="7.1" width="11.2" height="5.1" rx="0.9" fill="#d9d9d9" />
              <rect x="6.4" y="5.9" width="11.2" height="5.1" rx="0.9" fill="#f5f5f5" />
            </g>
            <path
              d="M3 8.5h7.2l1.8-2h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
              fill="currentColor"
              style={{ filter: "drop-shadow(0 -2px 4px var(--background))" }}
            />
          </svg>
        </div>
        <span className="text-lg font-medium text-background/80">
          {isLoading ? "Wird vorbereitet..." : "Datei hier ablegen, um direkt zu starten"}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          oder klicken, um deine Unterlagen auszuwählen
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md"
        className="hidden"
        disabled={isLoading}
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          void handleUpload(selected);
        }}
      />
    </div>
  );
}
