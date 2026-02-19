import { useState, useEffect } from "react";

type Theme = "light" | "dark" | "system";

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem("markvera-theme") as Theme;
        return stored || "light";
    });

    useEffect(() => {
        const root = document.documentElement;

        const applyTheme = (t: Theme) => {
            if (t === "system") {
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                root.classList.toggle("dark", prefersDark);
            } else {
                root.classList.toggle("dark", t === "dark");
            }
        };

        applyTheme(theme);
        localStorage.setItem("markvera-theme", theme);

        // Listen for system theme changes
        if (theme === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const handler = (e: MediaQueryListEvent) => {
                root.classList.toggle("dark", e.matches);
            };
            mediaQuery.addEventListener("change", handler);
            return () => mediaQuery.removeEventListener("change", handler);
        }
    }, [theme]);

    return { theme, setTheme };
}
