import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, CardHeader, Field, Input, PageHeader } from '@/components/ui';
import { useAction } from '../hooks';
import { useAdmin } from '../ctx';

export default function SettingsPage() {
  const { user, logout } = useAdmin();
  const act = useAction();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const mismatch = f.confirm !== '' && f.next !== f.confirm;
  const save = async () => {
    if (await act(() => api.post('/admin/auth/change-password', { current: f.current, next: f.next }), 'Password changed')) setF({ current: '', next: '', confirm: '' });
  };
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-3xl gap-5">
        <Card>
          <CardHeader title="Account" />
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><div className="font-semibold">{user.name}</div><div className="text-sm text-slate-500">{user.email}</div></div>
            <Button variant="outline" onClick={logout}><LogOut className="size-4" /> Sign out</Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Change password" sub="Use at least 8 characters." />
          <form className="grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <input type="text" autoComplete="username" value={user.email} readOnly hidden />
            <Field label="Current password" className="sm:col-span-2"><Input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
            <Field label="New password"><Input type="password" autoComplete="new-password" minLength={8} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
            <Field label="Confirm new password" hint={mismatch ? 'Passwords do not match' : undefined}><Input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button disabled={!f.current || f.next.length < 8 || f.next !== f.confirm}>Update password</Button></div>
          </form>
        </Card>
        <Card>
          <CardHeader title="Your data" />
          <p className="p-4 text-sm text-slate-600">Everything is stored in your MongoDB Atlas database. Download CSV copies of inquiries, bookings and expenses any time from <b>Reports</b>.</p>
        </Card>
      </div>
    </>
  );
}
