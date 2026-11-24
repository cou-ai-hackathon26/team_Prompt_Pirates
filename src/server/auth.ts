import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "~/env";

/** Staff login is optional infrastructure: patient pages never require it. */
export const authConfigured = Boolean(env.AUTH_SECRET && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }),
  ],
  secret: env.AUTH_SECRET,
  // JWT cookie sessions: no user tables needed. Vercel / localhost host headers are trusted.
  session: { strategy: "jwt", maxAge: 7 * 24 * 3600 },
  trustHost: true,
});

/**
 * Staff = emails listed in STAFF_EMAILS, nothing else. Families can sign in with Google too (to keep
 * their patients across phones), so "any signed-in account" must never mean staff.
 */
export function isStaff(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (env.STAFF_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** Any signed-in Google user (family or staff), or null. Never throws. */
export async function getUser() {
  if (!authConfigured) return null;
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase();
    return email ? { email, name: session?.user?.name ?? null, image: session?.user?.image ?? null } : null;
  } catch {
    return null;
  }
}

/** The signed-in staff member, or null. Never throws (e.g. when login is not configured). */
export async function getStaff() {
  if (!authConfigured) return null;
  try {
    const session = await auth();
    const email = session?.user?.email;
    return email && isStaff(email) ? { email, name: session.user?.name ?? email } : null;
  } catch {
    return null;
  }
}
