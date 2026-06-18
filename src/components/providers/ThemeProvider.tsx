// Compat shim: re-exporta el nuevo ThemeProvider/useTheme desde @/contexts/ThemeContext.
// Mantiene la API antigua `useTheme().theme === "dark"` para componentes ya escritos.
import { ThemeProvider as NewThemeProvider, useTheme as useNewTheme } from "@/contexts/ThemeContext";

export const ThemeProvider = NewThemeProvider;

export const useTheme = () => {
  const { resolvedDark, setMode } = useNewTheme();
  return {
    theme: resolvedDark ? ("dark" as const) : ("light" as const),
    setTheme: (t: "light" | "dark") => setMode(t),
    toggleTheme: () => setMode(resolvedDark ? "light" : "dark"),
  };
};
