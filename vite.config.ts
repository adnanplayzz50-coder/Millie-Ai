import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tanstackStart(),
    nitro(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.SUPABASE_PUBLISHABLE_KEY ??
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
        "",
    ),
  },
});
