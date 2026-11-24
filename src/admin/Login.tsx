import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { Field, Input } from '@/components/ui';

export default function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api.post('/auth/login', { email, password });
      onDone();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-sky p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border-[3px] border-ink bg-white p-7 shadow-[8px_8px_0_0_#FFDE59]">
        <Logo size={46} />
        <h1 className="mt-5 flex items-center gap-2 font-display text-2xl font-extrabold"><Lock className="size-5" /> Owner sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Private dashboard — authorised access only.</p>
        <div className="mt-5 space-y-3">
          <Field label="Email"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
          <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        </div>
        {err && <p role="alert" className="mt-3 rounded-lg bg-bad/10 px-3 py-2 text-sm font-semibold text-bad">{err}</p>}
        <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-sun py-3 font-display font-extrabold shadow-[3px_3px_0_0_#171717] transition hover:-translate-y-0.5 disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} Sign in
        </button>
        <a href="/" className="mt-4 block text-center text-xs font-semibold text-slate-500 hover:text-ink">← Back to website</a>
      </form>
    </div>
  );
}
