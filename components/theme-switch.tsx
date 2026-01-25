"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

type ThemeSwitchProps = {
  checked: boolean;
  onToggle: () => void;
  label?: string;
};

type Theme = "light" | "dark";

const THEME_KEY = "theme";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeSwitch({ checked, onToggle, label }: ThemeSwitchProps) {
  return (
    <button
      type="button"
      className="theme-switch"
      data-state={checked ? "checked" : "unchecked"}
      aria-pressed={checked}
      onClick={onToggle}
    >
      <span className="sr-only">{label ?? "Theme umschalten"}</span>
      <span className="theme-switch__thumb" aria-hidden="true">
        {checked ? (
          <MoonIcon className="theme-switch__icon" />
        ) : (
          <SunIcon className="theme-switch__icon" />
        )}
      </span>
    </button>
  );
}

export function ThemeSwitchClient() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) as Theme | null;
    const nextTheme = stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const isDark = theme === "dark";

  return (
    <ThemeSwitch
      checked={isDark}
      onToggle={() => {
        const nextTheme: Theme = isDark ? "light" : "dark";
        setTheme(nextTheme);
        window.localStorage.setItem(THEME_KEY, nextTheme);
        applyTheme(nextTheme);
      }}
      label={isDark ? "Dark Mode aktiv" : "Light Mode aktiv"}
    />
  );
}
