"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

export default function AdminThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem("roam-admin-theme");
    const preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    const initial: Theme = saved === "light" || saved === "dark" ? saved : preferred;
    setTheme(initial);
    document.documentElement.dataset.adminTheme = initial;
    document.documentElement.style.colorScheme = initial;
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem("roam-admin-theme", next);
    document.documentElement.dataset.adminTheme = next;
    document.documentElement.style.colorScheme = next;
  }

  return (
    <div className="roam-admin-theme-root" data-theme={theme} data-bs-theme={theme}>
      {children}
      <button
        type="button"
        className="roam-admin-theme-toggle btn btn-sm"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      </button>
    </div>
  );
}
