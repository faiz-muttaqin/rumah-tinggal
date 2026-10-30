import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 3101,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3100" },
  },
  build: {
    target: "es2023",
    sourcemap: false,
    rolldownOptions: {
      input: { main: "index.html", riset: "riset.html" },
      output: {
        codeSplitting: {
          groups: [
            { name: "map", test: /node_modules\/maplibre-gl/ },
            { name: "auth", test: /node_modules\/(?:@firebase|firebase)/ },
          ],
        },
      },
    },
  },
});
