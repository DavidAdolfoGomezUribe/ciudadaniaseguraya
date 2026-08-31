import { describe, expect, it, vi } from "vitest";

import { createGoogleIdentityProvider } from "../providers/google-identity.provider.js";

describe("Google Identity provider", () => {
  it("verifica audience y devuelve solo identidad necesaria", async () => {
    const getPayload = vi.fn(() => ({
      sub: "google-subject-1",
      email: "persona@example.com",
      email_verified: true,
      name: "Persona",
      picture: "https://example.com/private-picture",
    }));
    const oauthClient = {
      verifyIdToken: vi.fn(async () => ({ getPayload })),
    };
    const provider = createGoogleIdentityProvider({
      clientId: "web-client.apps.googleusercontent.com",
      oauthClient,
    });

    await expect(
      provider.verifyCredential("credential"),
    ).resolves.toEqual({
      subject: "google-subject-1",
      email: "persona@example.com",
      name: "Persona",
    });
    expect(oauthClient.verifyIdToken).toHaveBeenCalledWith({
      idToken: "credential",
      audience: "web-client.apps.googleusercontent.com",
    });
  });

  it("falla cerrado cuando Google no esta configurado", async () => {
    const provider = createGoogleIdentityProvider({ clientId: "" });

    await expect(provider.verifyCredential("credential")).rejects.toMatchObject(
      {
        code: "GOOGLE_AUTH_NOT_CONFIGURED",
        statusCode: 503,
      },
    );
  });

  it("rechaza credenciales invalidas o correos no verificados", async () => {
    const invalidClient = {
      verifyIdToken: vi.fn(async () => {
        throw new Error("invalid signature");
      }),
    };
    const unverifiedClient = {
      verifyIdToken: vi.fn(async () => ({
        getPayload: () => ({
          sub: "google-subject-1",
          email: "persona@example.com",
          email_verified: false,
        }),
      })),
    };

    await expect(
      createGoogleIdentityProvider({
        clientId: "client",
        oauthClient: invalidClient,
      }).verifyCredential("credential"),
    ).rejects.toMatchObject({
      code: "INVALID_GOOGLE_CREDENTIAL",
      statusCode: 401,
    });
    await expect(
      createGoogleIdentityProvider({
        clientId: "client",
        oauthClient: unverifiedClient,
      }).verifyCredential("credential"),
    ).rejects.toMatchObject({
      code: "INVALID_GOOGLE_CREDENTIAL",
      statusCode: 401,
    });
  });
});
