import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

type ExtendedTheme = "light" | "dark";

export default function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const currentTheme = (theme === "light" ? "light" : "dark") as ExtendedTheme;
    const [previousTheme, setPreviousTheme] = useState<string>(
        currentTheme === "light" ? "1" : "2"
    );

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
