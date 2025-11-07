"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  type AuthenticatorTransportFuture,
  type WebAuthnCredential,
} from "@simplewebauthn/server";

import {
  ZPinSetup,
  ZPinVerify,
} from "@/lib/validators";
import {
  clearPasskey,
  ensureUserPref,
  getUserPref,
  savePasskeyCredential,
  setPasskeyChallenge,
  updatePin,
  updatePasskeyCounter,
} from "@/lib/repo/user-pref";

const RP_NAME = "G-Finance";
const RP_ID = process.env.WEBAUTHN_RP_ID ?? process.env.NEXT_PUBLIC_RP_ID ?? "localhost";
const ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? `http://${RP_ID}`;

type ActionSuccess<T> = { success: true; data: T };
type ActionFailure = { success: false; error: string };

function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

function failure(error: unknown): ActionFailure {
  const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
  console.error("[security actions]", error);
  return { success: false, error: message };
}

export async function getSecurityStatus() {
  try {
    const pref = await ensureUserPref();
    return success({
      pinEnabled: Boolean(pref.pinHash),
      passkeyRegistered: Boolean(pref.passkeyCredentialId),
      biometricEnabled: pref.biometricEnabled,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function setPin(input: { pin: string; confirmPin: string }) {
  try {
    const payload = ZPinSetup.parse(input);
    const hash = await bcrypt.hash(payload.pin, 12);
    await updatePin(hash);
    await revalidatePath("/settings/security");
    return success({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

export async function clearPin() {
  try {
    await updatePin(null);
    await revalidatePath("/settings/security");
    return success({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

export async function verifyPin(input: { pin: string }) {
  try {
    const payload = ZPinVerify.parse(input);
    const pref = await getUserPref();
    if (!pref?.pinHash) {
      return failure("PIN belum diatur.");
    }
    const match = await bcrypt.compare(payload.pin, pref.pinHash);
    if (!match) {
      return failure("PIN salah.");
    }
    return success({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

export async function generatePasskeyRegistration() {
  try {
    const pref = await ensureUserPref();
    const userIdBytes = new TextEncoder().encode(pref.id);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userIdBytes,
      userName: "user",
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: pref.passkeyCredentialId
        ? [
            {
              id: pref.passkeyCredentialId,
            },
          ]
        : [],
    });
    await setPasskeyChallenge(options.challenge);
    return success(options);
  } catch (error) {
    return failure(error);
  }
}

export async function verifyPasskeyRegistration(input: { response: RegistrationResponseJSON }) {
  try {
    const pref = await ensureUserPref();
    if (!pref.passkeyCurrentChallenge) {
      throw new Error("Tidak ada challenge aktif.");
    }

    const verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: pref.passkeyCurrentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Registrasi passkey gagal diverifikasi.");
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    await savePasskeyCredential({
      credentialId: credential.id,
      publicKey: bufferToBase64url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? input.response.response.transports ?? undefined,
    });
    await setPasskeyChallenge(null);
    await revalidatePath("/settings/security");

    return success({
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function generatePasskeyAuthentication() {
  try {
    const pref = await ensureUserPref();
    if (!pref.passkeyCredentialId) {
      throw new Error("Belum ada passkey yang terdaftar.");
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: pref.passkeyCredentialId
        ? [
            {
              id: pref.passkeyCredentialId,
              transports: pref.passkeyTransports
                ?.split(",")
                .filter((entry) => entry.length > 0) as AuthenticatorTransportFuture[] | undefined,
            },
          ]
        : undefined,
      userVerification: "preferred",
    });
    await setPasskeyChallenge(options.challenge);
    return success<PublicKeyCredentialRequestOptionsJSON>(options);
  } catch (error) {
    return failure(error);
  }
}

export async function verifyPasskeyAuthentication(input: { response: AuthenticationResponseJSON }) {
  try {
    const pref = await ensureUserPref();
    if (!pref.passkeyCredentialId || !pref.passkeyPublicKey) {
      throw new Error("Belum ada passkey yang terdaftar.");
    }
    if (!pref.passkeyCurrentChallenge) {
      throw new Error("Tidak ada challenge aktif.");
    }

    const credential: WebAuthnCredential = {
      id: pref.passkeyCredentialId,
      publicKey: base64urlToUint8Array(pref.passkeyPublicKey),
      counter: pref.passkeyCounter ?? 0,
      transports: pref.passkeyTransports
        ?.split(",")
        .filter((entry) => entry.length > 0) as AuthenticatorTransportFuture[] | undefined,
    };

    const verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: pref.passkeyCurrentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      throw new Error("Verifikasi passkey gagal.");
    }

    await updatePasskeyCounter(verification.authenticationInfo.newCounter);
    await setPasskeyChallenge(null);
    return success({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

export async function removePasskey() {
  try {
    await clearPasskey();
    await setPasskeyChallenge(null);
    await revalidatePath("/settings/security");
    return success({ ok: true });
  } catch (error) {
    return failure(error);
  }
}

function base64urlToUint8Array(value: string | null) {
  if (!value) {
    return new Uint8Array();
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const base64 = padded.padEnd(Math.ceil(padded.length / 4) * 4, "=");
  const bytes = Buffer.from(base64, "base64");
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function bufferToBase64url(buffer: Uint8Array | Buffer | ArrayBuffer) {
  const bytes =
    buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const b64 = Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
