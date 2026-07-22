import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Refreshes the Supabase auth session cookie on each request and guards both
// portals: /admin (staff, app_metadata.role === 'admin') and the customer
// account area (/dashboard, /claim, /rewards, /history — any signed-in user).

// Kept in sync with the route group src/app/(customer)/(account)/.
const ACCOUNT_PREFIXES = ["/dashboard", "/claim", "/rewards", "/history"]
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAdmin = path.startsWith("/admin")
  const isAdminLogin = path === "/admin/login"
  const isAccount = ACCOUNT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )
  const isCustomerAuth = path === "/login" || path === "/register"
  // Staff carry the claim; customers never do (app_metadata is service-role
  // writable only, so it cannot be self-assigned).
  const isStaff = user?.app_metadata?.role === "admin"

  const redirect = (pathname: string) => {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Unauthenticated hitting a protected admin route -> admin login.
  if (isAdmin && !isAdminLogin && !user) return redirect("/admin/login")
  // A customer session must not linger on /admin — send it to its own area.
  if (isAdmin && user && !isStaff) return redirect("/dashboard")
  // Already staff hitting the admin login -> admin dashboard.
  if (isAdminLogin && isStaff) return redirect("/admin")

  // Customer area requires any session; the customer login is /login.
  if (isAccount && !user) return redirect("/login")
  if (isCustomerAuth && user) return redirect(isStaff ? "/admin" : "/dashboard")

  return supabaseResponse
}
