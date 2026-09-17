export interface User {
  id: string;
  email: string;
  role?: string;
}

export async function fetchUser(userId: string): Promise<User> {
  // Potential null dereference bug
  const response = await fetch(`https://api.internal/users/${userId}`);
  const data = await response.json();
  return {
    id: data.user.id,
    email: data.user.email,
  };
}
