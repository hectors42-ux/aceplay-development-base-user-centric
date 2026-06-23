import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // El render del Home monta muchos componentes; bajo ejecución paralela de
    // toda la suite puede pasarse del default de 5s. Damos margen para evitar
    // timeouts intermitentes (de forma aislada los tests pasan holgados).
    testTimeout: 15000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
