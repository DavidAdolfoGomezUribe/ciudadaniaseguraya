function baseUserDto(user) {
  return {
    id: user._id.toHexString(),
    username: user.username,
    displayName: user.displayName ?? user.username,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toPublicUserDto(user) {
  return {
    id: user._id.toHexString(),
    username: user.username,
    displayName: user.displayName ?? user.username,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toOwnUserDto(user) {
  const authProviders = [];
  if (user.passwordHash) {
    authProviders.push("password");
  }
  if (user.googleSubject) {
    authProviders.push("google");
  }

  return {
    ...baseUserDto(user),
    email: user.email,
    emailVerified: user.emailVerified,
    authProviders,
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

export function toAdminUserDto(user) {
  return {
    ...baseUserDto(user),
    emailVerified: user.emailVerified,
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    deletedAt: user.deletedAt?.toISOString() ?? null,
  };
}

export function toAdminSessionUserDto(user, permissions) {
  return {
    id: user._id.toHexString(),
    username: user.username,
    displayName: user.displayName ?? user.username,
    role: user.role,
    permissions: [...permissions],
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}
