import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { sendMagicLink } from "../lib/auth";

/**
 * Gate in front of the whole app. No account, no chat, this is what makes
 * @handle and the PIN model mean something instead of being one shared
 * local browser identity.
 */
export function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError("");
    try {
      await sendMagicLink(trimmed);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the sign-in link.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="signin-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />
      <div className="signin-card glass">
        <img className="signin-logo" src="/logo-mark.png" alt="" />
        <h1>RideArrivo Ops</h1>
        <p className="signin-copy">Sign in with your work email to open PArA.</p>

        {sent ? (
          <div className="signin-sent">
            <p>
              Check <strong>{email}</strong> for a sign-in link. Open it on this device to continue,
              it'll bring you straight back here signed in.
            </p>
            <button
              type="button"
              className="signin-resend"
              onClick={() => {
                setSent(false);
                setError("");
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form className="signin-form" onSubmit={submit}>
            <label className="signin-field">
              <Mail size={16} />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@ridearrivo.com"
              />
            </label>
            <button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send sign-in link"}
            </button>
            {error && <span className="signin-error">{error}</span>}
          </form>
        )}
      </div>
    </div>
  );
}
