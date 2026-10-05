import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { AsyncForm, Field, Notice } from '../components/ui';
export function PasswordResetPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [message, setMessage] = useState('');
  return (
    <main className="onboarding">
      <Link className="text-link" to="/">
        ← Back to sign in
      </Link>
      <h1 style={{ marginTop: 24 }}>
        {token ? 'Choose a new password.' : 'Recover your account.'}
      </h1>
      {message ? (
        <Notice>{message}</Notice>
      ) : (
        <AsyncForm
          submit={token ? 'Reset password' : 'Request reset link'}
          onSubmit={async (d) => {
            const r = await api<{ message: string }>(
              token ? '/auth/reset-password' : '/auth/forgot-password',
              'POST',
              token ? { token, password: d.get('password') } : { email: d.get('email') },
            );
            setMessage(r.message);
          }}
        >
          {token ? (
            <Field label="New password">
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={72}
                required
                autoComplete="new-password"
              />
            </Field>
          ) : (
            <Field label="Email address">
              <input name="email" type="email" required autoComplete="email" />
            </Field>
          )}
        </AsyncForm>
      )}
      <p className="tiny muted">
        For local testing, reset links are written to the backend’s private data/mail-outbox folder.
        External email delivery is not enabled.
      </p>
    </main>
  );
}
