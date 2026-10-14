import { configEnv } from "subatom";
configEnv();

import { defineConfig } from "subatom";

export default defineConfig({
      port: Number(process.env.PORT),
      host: process.env.HOST,
      outDir: "build",
      sourcemap: true,
      minify: true,
      entry:"main.ts",
      watch: {
          extensions: ["ts", "tsx", "js", "jsx"],
          debounceMs: 500,
          ignore: ["**/logs/**"],
      }
});