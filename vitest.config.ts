import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

// Vitest runs the modules straight out of src/, without the Next compiler, so it
// needs the two things Next would otherwise provide:
//
//   * the `@/` path alias from tsconfig;
//   * a stand-in for `server-only`, whose default export deliberately throws.
//     Next resolves it through the `react-server` condition to an empty module
//     on the server; the test runner has no such condition, so the same empty
//     module is wired up by hand. It is the marker package, not behaviour — the
//     functions under test here are pure.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    // Split by extension rather than by path: a component test contains JSX and
    // is therefore a .tsx file, a pure unit test is not. Nothing has to move
    // between folders, and it keeps the node-only helpers (loyalty.ts,
    // pancake/client.ts — both of which pull in @supabase/supabase-js) out of
    // jsdom, where Vite would resolve them through browser export conditions
    // instead. `extends: true` inherits the aliases above.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
          // Undo the DOM stubs and any per-test vi.stubEnv between tests.
          unstubGlobals: true,
          unstubEnvs: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      // Harnesses, tests themselves, generated row types and the message
      // catalogs have nothing to assert — counting them only dilutes the number.
      exclude: [
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/lib/db-types.ts",
        "src/lib/i18n/messages/**",
      ],
    },
  },
})
