// Signs in with supabase-js and prints the cookie @supabase/ssr would have set,
// so curl can hit authenticated pages without driving a browser.
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync("/Users/emnhoa/Documents/Nhoa/.env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const ref = new URL(url).hostname.split(".")[0]

const [email, password] = process.argv.slice(2)
const supabase = createClient(url, key)
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
if (error) {
  console.error("LOGIN_FAILED", error.message)
  process.exit(1)
}

const session = data.session
const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url")
// Chunk exactly the way @supabase/ssr does when the value exceeds the limit.
const CHUNK = 3180
const name = `sb-${ref}-auth-token`
const cookies =
  value.length <= CHUNK
    ? [[name, value]]
    : Array.from({ length: Math.ceil(value.length / CHUNK) }, (_, i) => [
        `${name}.${i}`,
        value.slice(i * CHUNK, (i + 1) * CHUNK),
      ])

console.log(
  JSON.stringify({
    role: data.user.app_metadata?.role ?? null,
    userId: data.user.id,
    cookie: cookies.map(([n, v]) => `${n}=${v}`).join("; "),
  }),
)
