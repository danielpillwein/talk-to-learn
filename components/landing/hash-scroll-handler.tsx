"use client";

import { useEffect } from "react";

const LANDING_HEADER_OFFSET = 88;

function scrollToCurrentHash(behavior: ScrollBehavior): void {
  const rawHash = window.location.hash;
  if (!rawHash || rawHash === "#") return;

  const elementId = decodeURIComponent(rawHash.slice(1));
  const target = document.getElementById(elementId);
  if (!target) return;

  const targetTop = window.scrollY + target.getBoundingClientRect().top - LANDING_HEADER_OFFSET;
  window.scrollTo({ top: Math.max(0, targetTop), behavior });
}

export function HashScrollHandler(): JSX.Element | null {
  useEffect(() => {
    // Wait until layout settles, then align hash target below the fixed header.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToCurrentHash("auto");
      });
    });

    const handleHashChange = () => {
      scrollToCurrentHash("smooth");
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return null;
}
