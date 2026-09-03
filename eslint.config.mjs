import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored skill packs — not our source.
    ".agents/**",
    // The v8 HTML coverage reporter emits its own JS assets.
    "coverage/**",
  ]),
  {
    // `m`, never `motion`. src/lib/motion/provider.tsx mounts LazyMotion in
    // STRICT mode, where a `motion.div` throws at render — but only if it is
    // actually rendered. A stray `motion.*` in a vendored Animate UI file that
    // is imported and never reached throws nothing and silently pulls the full
    // feature bundle in, which is the whole thing LazyMotion exists to avoid.
    // That failure is invisible to tsc and to vitest, so it is caught here.
    // Every file under src/components/animate-ui/ is rewritten to `m` as part
    // of the post-install pass documented in AGENTS.md.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "motion/react",
              importNames: ["motion"],
              message:
                "Import `m` instead — LazyMotion runs in strict mode. See src/lib/motion/provider.tsx.",
            },
            {
              name: "framer-motion",
              message:
                "This project depends on `motion`, not `framer-motion`. Import from `motion/react`.",
            },
          ],
        },
      ],
    },
  },
  {
    // The bento's no-hole rule, now that it is only a rule. LazyMotion loads
    // `domMax` since ui/ moved onto Animate UI (switch and tabs need `layout`),
    // so a layout animation inside the 12-column dashboard grid would actually
    // run — transforming a tile out of the cell its span assigned it and
    // leaving exactly the hole ENGAGEMENT_SPAN and the 4-slot tenant rule exist
    // to prevent. See src/lib/motion/provider.tsx.
    files: ["src/app/(customer)/(account)/dashboard/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // Scoped to `<m.* />` on purpose: `layout` is also an ordinary
          // string prop in this codebase (PostCard takes layout="tile").
          selector:
            'JSXOpeningElement[name.type="JSXMemberExpression"][name.object.name="m"] > JSXAttribute[name.name=/^(layout|layoutId)$/]',
          message:
            "No layout animation inside the dashboard bento — it transforms a tile out of its grid cell and leaves a hole.",
        },
      ],
    },
  },
]);

export default eslintConfig;
