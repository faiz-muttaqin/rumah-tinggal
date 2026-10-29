import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, readConfig } from "./app.ts";

export { createApp, readConfig } from "./app.ts";

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const config = readConfig();
    const app = createApp({ config });
    app.server.on("error", () => {
      console.error(
        "Server gagal dimulai. Periksa konfigurasi lokal dan port.",
      );
      void app.close().finally(() => {
        process.exitCode = 1;
      });
    });
    app.server.listen(config.port, "127.0.0.1", () => {
      console.log(
        `Rumah Tinggal berjalan di loopback pada port ${config.port}.`,
      );
    });
    let stopping = false;
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      process.on(signal, () => {
        if (stopping) return;
        stopping = true;
        void app.close().catch(() => {
          process.exitCode = 1;
        });
      });
    }
  } catch {
    console.error(
      "Server gagal dimulai. Periksa konfigurasi lokal dan izin data.",
    );
    process.exitCode = 1;
  }
}
