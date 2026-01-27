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
        className={`relative w-full flex min-h-[172px] cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-8 py-6 text-center text-base font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          isDragging
            ? "border-success/60 text-foreground shadow-[0_0_22px_rgba(95,185,125,0.3)]"
            : "border-success/50 text-foreground hover:shadow-[0_0_18px_rgba(95,185,125,0.25)]"
        }`}
        style={{
          backgroundColor: isDragging
            ? "color-mix(in srgb, var(--foreground) 75%, transparent)"
            : "color-mix(in srgb, var(--foreground) 50%, transparent)",
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const dropped = event.dataTransfer.files?.[0] ?? null;
          void handleUpload(dropped);
        }}
      >
        <div className="absolute right-3 top-3 z-50">
          <InfoTooltip title="Nur eine Datei (*.pdf, *.txt, *.md)" />
        </div>
        <span className="text-lg font-semibold text-background">
          {isLoading ? "Wird vorbereitet..." : "Datei hier ablegen, um direkt zu starten"}
        </span>
        <span className="text-sm font-medium text-background/80">
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
