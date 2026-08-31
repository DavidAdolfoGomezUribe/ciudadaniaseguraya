import { createUsersRepository } from "../../modules/users/repositories/users.repository.js";
import { hashPassword, verifyPassword } from "../security/password.js";
import {
  normalizeEmail,
  normalizeUsername,
} from "../utils/normalization.js";

function sameUser(left, right) {
  return left && right && left._id.equals(right._id);
}

function configuredSuperadmin(config) {
  const email = config.superadminEmail.trim();
  const username = config.superadminUsername.trim();
  const password = config.superadminPassword;

  if (!email && !username && !password) {
    return null;
  }

  if (!email || !username || !password) {
    throw new Error(
      "SUPERADMIN_EMAIL, SUPERADMIN_USERNAME y SUPERADMIN_PASSWORD deben configurarse juntos",
    );
  }

  return {
    email,
    normalizedEmail: normalizeEmail(email),
    username,
    normalizedUsername: normalizeUsername(username),
    password,
    displayName: config.superadminDisplayName?.trim() || username,
  };
}

async function passwordMatches(passwordHash, password) {
  try {
    return await verifyPassword(passwordHash, password);
  } catch (_error) {
    return false;
  }
}

/**
 * Makes the bootstrap superadmin in MongoDB match the configured environment.
 * An empty configuration deliberately leaves the database untouched.
 */
export async function syncSuperadmin({
  config,
  db,
  clock = () => new Date(),
} = {}) {
  if (!config) {
    throw new Error("syncSuperadmin requiere configuracion");
  }

  const desired = configuredSuperadmin(config);
  if (!desired) {
    return { status: "skipped" };
  }
  if (!db) {
    throw new Error("syncSuperadmin requiere una base de datos");
  }

  const users = createUsersRepository(db);
  const [bootstrap, emailOwner, usernameOwner, superadmins] =
    await Promise.all([
      users.findBootstrapSuperadmin(),
      users.findByNormalizedEmail(desired.normalizedEmail),
      users.findByNormalizedUsername(desired.normalizedUsername),
      users.findSuperadmins(),
    ]);

  if (superadmins.length > 1) {
    throw new Error(
      "Hay mas de un superadmin en la base de datos; no se puede elegir uno para sincronizar",
    );
  }
  if (emailOwner && usernameOwner && !sameUser(emailOwner, usernameOwner)) {
    throw new Error(
      "El email y username configurados pertenecen a cuentas diferentes",
    );
  }

  const existing = bootstrap ?? superadmins[0] ?? emailOwner ?? usernameOwner;
  for (const owner of [emailOwner, usernameOwner]) {
    if (owner && existing && !sameUser(owner, existing)) {
      throw new Error(
        "El email o username configurado pertenece a otra cuenta",
      );
    }
  }
  if (existing && existing.role !== "superadmin") {
    throw new Error(
      "Las credenciales configuradas pertenecen a una cuenta no administrativa",
    );
  }

  const now = clock();
  if (!existing) {
    const passwordHash = await hashPassword(desired.password);
    const result = await users.create({
      email: desired.email,
      normalizedEmail: desired.normalizedEmail,
      username: desired.username,
      normalizedUsername: desired.normalizedUsername,
      displayName: desired.displayName,
      passwordHash,
      role: "superadmin",
      status: "active",
      emailVerified: true,
      adminMetadata: {
        promotedAt: now,
        promotedBy: null,
        promotionReason: "Bootstrap del sistema",
        isBootstrapSuperadmin: true,
      },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastLoginAt: null,
    });
    return { status: "created", userId: result.insertedId };
  }

  const samePassword = await passwordMatches(
    existing.passwordHash,
    desired.password,
  );
  const unchanged =
    samePassword &&
    existing.email === desired.email &&
    existing.normalizedEmail === desired.normalizedEmail &&
    existing.username === desired.username &&
    existing.normalizedUsername === desired.normalizedUsername &&
    existing.displayName === desired.displayName &&
    existing.role === "superadmin" &&
    existing.status === "active" &&
    existing.emailVerified === true &&
    existing.deletedAt === null &&
    existing.adminMetadata?.isBootstrapSuperadmin === true;
  if (unchanged) {
    return { status: "unchanged", userId: existing._id };
  }

  const changes = {
    email: desired.email,
    normalizedEmail: desired.normalizedEmail,
    username: desired.username,
    normalizedUsername: desired.normalizedUsername,
    displayName: desired.displayName,
    "adminMetadata.promotedAt":
      existing.adminMetadata?.promotedAt ?? existing.createdAt ?? now,
    "adminMetadata.promotedBy": null,
    "adminMetadata.promotionReason": "Bootstrap del sistema",
  };
  if (!samePassword) {
    changes.passwordHash = await hashPassword(desired.password);
  }

  const updated = await users.updateBootstrapSuperadmin(existing._id, changes, now);
  return { status: "updated", userId: updated._id };
}
