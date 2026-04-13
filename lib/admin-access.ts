export function getAdminEmails() {
  const raw =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ??
    process.env.ADMIN_EMAILS ??
    ''

  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false
  }

  return getAdminEmails().includes(email.toLowerCase())
}

export function hasAdminAccess(identity?: { email?: string | null; profileEmail?: string | null }) {
  if (!identity) {
    return false
  }

  return isAdminEmail(identity.email) || isAdminEmail(identity.profileEmail)
}
