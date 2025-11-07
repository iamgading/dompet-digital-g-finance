"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative h-10 w-10 rounded-full"
        aria-label="Sedang memuat toggle tema"
        disabled
      >
        <Sun className="h-5 w-5" />
        <span className="sr-only">Toggle tema</span>
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  const handleToggleTheme = () => setTheme(isDark ? "light" : "dark");

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative h-10 w-10 rounded-full transition-colors hover:bg-primary/10 dark:hover:bg-primary/20"
      onClick={handleToggleTheme}
      aria-label="Toggle tema"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle tema</span>
    </Button>
  );
}
