
import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect } from "react";

type ExtendedTheme = "light" | "dark";

export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [previousTheme, setPreviousTheme] = useState<string>("2"); // Default to dark (2)

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
        if (theme === 'dark') setPreviousTheme("2");
        else setPreviousTheme("1");
    }, [theme]);

    if (!mounted) return null;

    const currentTheme = (theme === "system" ? "dark" : theme) as ExtendedTheme;

    const getOptionNumber = (t: string) => {
        if (t === "light") return "1";
        if (t === "dark") return "2";
        return "2";
    };

    const handleThemeChange = (t: ExtendedTheme) => {
        setPreviousTheme(getOptionNumber(currentTheme));
        setTheme(t);
    };

    return (
        <fieldset className="switcher" data-previous={previousTheme}>
            <legend className="switcher__legend">Theme Switcher</legend>

            <label className="switcher__option" title="Light theme">
                <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={currentTheme === "light"}
                    onChange={() => handleThemeChange("light")}
                    className="switcher__input"
                    data-option="1"
                />
                <Sun className="switcher__icon" style={{ color: "var(--c)" }} strokeWidth={2} size={28} />
            </label>

            <label className="switcher__option" title="Dark theme">
                <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={currentTheme === "dark"}
                    onChange={() => handleThemeChange("dark")}
                    className="switcher__input"
                    data-option="2"
                />
                <Moon className="switcher__icon" style={{ color: "var(--c)" }} strokeWidth={2} size={28} />
            </label>
        </fieldset>
    );
}
