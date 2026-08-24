export function displayName(user: any): string {
  const parts = [user?.firstName, user?.lastName].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  if (user?.username) {
    return `@${user.username}`;
  }

  return "there";
}
