interface ServerAuthClient {
  getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
}

type AuthFailure = { code: string; status: 401 | 403 | 503 };

// getUser returns SDK transport/deadline failures as errors, rather than
// throwing. Only an explicit authentication refusal invalidates the session.
export function classifyServerAuthFailure(error: unknown): AuthFailure {
  if (error && typeof error === 'object') {
    const value = error as { status?: unknown; name?: unknown };
    if (value.status === 401 || value.name === 'AuthSessionMissingError') {
      return { code: 'unauthorized', status: 401 };
    }
    if (value.status === 403) return { code: 'forbidden', status: 403 };
  }
  return { code: 'auth_unavailable', status: 503 };
}

export async function authorizeServerUser(
  auth: ServerAuthClient,
  failure: (code: string, status: 401 | 403 | 503) => Error,
): Promise<string> {
  let result: Awaited<ReturnType<ServerAuthClient['getUser']>>;
  try {
    result = await auth.getUser();
  } catch (error) {
    const classified = classifyServerAuthFailure(error);
    throw failure(classified.code, classified.status);
  }
  if (result.error) {
    const classified = classifyServerAuthFailure(result.error);
    throw failure(classified.code, classified.status);
  }
  if (!result.data.user?.id) throw failure('unauthorized', 401);
  return result.data.user.id;
}
