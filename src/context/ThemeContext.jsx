import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "narxtop_theme";
const ACCENT_STORAGE_KEY = "narxtop_site_accent";

export const SITE_ACCENTS = [
  { id: "brown", swatch: "#805435", label: "acc.accent.brown" },
  { id: "blue", swatch: "#245dba", label: "acc.accent.blue" },
  { id: "green", swatch: "#167247", label: "acc.accent.green" },
  { id: "violet", swatch: "#6641bb", label: "acc.accent.violet" },
  { id: "purple", swatch: "#7c3fb4", label: "acc.accent.purple" },
  { id: "red", swatch: "#b52e36", label: "acc.accent.red" },
  { id: "yellow", swatch: "#946600", label: "acc.accent.yellow" },
];
const isSiteAccent = (value) => SITE_ACCENTS.some((accent) => accent.id === value);


const PREFERENCES = ["system", "light", "dark"];
const DARK_QUERY = "(prefers-color-scheme: dark)";

/* What the phone / PC itself is set to right now. */
function systemTheme() {
  try {
    return window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "dark";
  }
}

/* The saved choice: "system" (follow the device), "light" or "dark". */
function getInitialPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (PREFERENCES.includes(saved)) return saved;
  } catch {
    /* ignore */
  }

  return "system"; // default: follow the phone / PC until the user picks Light or Dark
}

function getInitialAccent() {
  try {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isSiteAccent(saved)) return saved;
  } catch { /* ignore */ }
  return "brown";
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(getInitialPreference);
  const [systemMode, setSystemMode] = useState(systemTheme);
  // "system" resolves to whatever the device is using; light / dark are fixed.
  const theme = preference === "system" ? systemMode : preference;
  const [accent, setAccentState] = useState(getInitialAccent);
  const setAccent = useCallback((value) => {
    if (isSiteAccent(value)) setAccentState(value);
  }, []);

  // Follow the device live: when the phone / PC flips between light and dark, the site flips with it.
  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY);
    if (!query) return undefined;
    const onChange = (event) => setSystemMode(event.matches ? "dark" : "light");
    onChange(query);
    if (query.addEventListener) {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    query.addListener?.(onChange); // old Safari
    return () => query.removeListener?.(onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.themePreference = preference;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0b0705" : "#e8d5c1");

    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* ignore */
    }
  }, [theme, preference]);

  const animateSwitch = useCallback(() => {
    const root = document.documentElement;
    root.classList.add("theme-anim"); // short colour cross-fade (see design.css)
    setTimeout(() => root.classList.remove("theme-anim"), 450);
  }, []);

  const setPreference = useCallback((value) => {
    if (!PREFERENCES.includes(value)) return;
    setPreferenceState((current) => {
      if (current !== value) animateSwitch();
      return value;
    });
  }, [animateSwitch]);

  useEffect(() => {
    document.documentElement.dataset.siteAccent = accent;
    try { localStorage.setItem(ACCENT_STORAGE_KEY, accent); } catch { /* ignore */ }
  }, [accent]);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference,
      accent,
      setAccent,
      isDark: theme === "dark",
      isSystem: preference === "system",
      // quick light <-> dark flip (navbar button): always lands on an explicit choice
      toggleTheme: () => {
        animateSwitch();
        setPreferenceState(theme === "dark" ? "light" : "dark");
      },
    }),
    [theme, preference, setPreference, accent, setAccent, animateSwitch]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
