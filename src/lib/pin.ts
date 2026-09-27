import { useCallback, useEffect, useState } from "react";

/**
 * The PArA Pin model.
 *
 * This is the one identity/security primitive PArA uses everywhere it needs
 * a lightweight "prove it's you" step, unlocking a locked message today,
 * and (by design) the same primitive for joining a call unattended or
 * approving a sensitive action in RA-workspace later. Keeping it in one
 * place means every surface that needs step-up auth reuses the same rules
 * instead of reinventing them slightly differently each time.
 *
 * Two identifiers, two different jobs:
 *   - HANDLE  -> public, stable, shareable. "Who is this." Never secret.
 *   - PIN     -> private, 7 digits, guessable-but-rate-limited. "Prove it's
 *               you, right now." Never shown, never logged, never sent
 *               anywhere in plaintext outside of the verify request itself.
 *
 * The PIN itself is set and checked server-side (see set_own_pin and
 * verify_own_pin in supabase/migrations/0001_chat_backend.sql). The client
 * only ever sends a candidate guess over an authenticated request and gets
 * back true or false, it never holds, sees, or compares the real PIN. This
 * file is the CLIENT-SIDE half: format rules and a lockout guard so the UI
 * can't be brute-forced by mashing the unlock button. The lockout itself is
 * still per-browser-tab, not per-account, see the note at the bottom for
 * what closing that gap looks like.
 */

export const PIN_LENGTH = 7;
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 30_000;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export function sanitizePinInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, PIN_LENGTH);
}

type PinGuardState = {
  /** True once MAX_ATTEMPTS wrong guesses land inside one lockout window. */
  isLocked: boolean;
  /** Seconds remaining until the guard accepts attempts again. 0 when unlocked. */
  secondsLeft: number;
  /** Attempts left before the next lockout kicks in. */
  attemptsLeft: number;
  /** Check a candidate PIN against the server. Always resolves false while
   *  locked, and counts every wrong guess toward the lockout regardless of
   *  which message, call, or action prompted it, the guard is per-account,
   *  not per-item, because the thing being protected is "can this device
   *  brute-force my PIN," not any single message. */
  verify: (candidate: string) => Promise<boolean>;
};

/**
 * One shared lockout guard per signed-in account. Mount it once near the
 * top of the app (not per-message) and pass `verify`/`isLocked`/
 * `secondsLeft` down to whatever surface needs a PIN prompt, a locked
 * message, a "confirm before joining this call" step, a wallet approval.
 *
 * `verifyRemote` does the actual check, wired to verify_own_pin() so the
 * real PIN never leaves the server.
 */
export function usePinGuard(verifyRemote: (candidate: string) => Promise<boolean>): PinGuardState {
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (lockedUntil === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && lockedUntil > Date.now();

  const verify = useCallback(
    async (candidate: string) => {
      if (isLocked) return false;
      const ok = await verifyRemote(candidate);
      if (ok) {
        setAttempts(0);
        return true;
      }
      setAttempts((current) => {
        const next = current + 1;
        if (next >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS);
        }
        return next;
      });
      return false;
    },
    [verifyRemote, isLocked]
  );

  return { isLocked, secondsLeft, attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts), verify };
}

/**
 * What's still simplified, and what closing the gap looks like
 * --------------------------------------------------------------
 * 1. The lockout counter lives in this browser tab's React state. Closing
 *    the tab resets it. Moving it server-side means verify_own_pin itself
 *    tracks attempts and a locked_until timestamp on the profile row, and
 *    returns that state instead of a bare boolean, so a cleared tab or a
 *    second device doesn't get a fresh set of guesses.
 * 2. Add rate limiting at the network layer too (per-IP and per-account, a
 *    Supabase Edge Function in front of the RPC, or a database function
 *    with its own counter table), so the lockout isn't the only thing
 *    standing between an attacker and 10^7 guesses.
 * 3. For locked-message content specifically, consider going further than
 *    "PIN gates a reveal": derive a symmetric key from the PIN (or a key
 *    the PIN unlocks) and actually encrypt the message body at rest, so a
 *    database leak doesn't hand over locked content in plaintext. The
 *    current version is a UI gate backed by a real server-side check, not
 *    encryption, call it that explicitly wherever compliance or security
 *    review happens.
 */
