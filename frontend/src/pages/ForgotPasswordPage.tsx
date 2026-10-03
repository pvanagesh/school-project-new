import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Link, Paper, TextField, Typography } from '@mui/material';
import { requestPasswordReset } from '../api/auth';
import { ChalkboardBanner } from '../illustrations/SchoolIllustrations';
import { firstApiError } from '../utils/apiError';

export function ForgotPasswordPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(usernameOrEmail);
      // Always shown, whether or not the account actually exists — the API
      // deliberately doesn't say either way.
      setSubmitted(true);
    } catch (err) {
      setError(firstApiError(err, 'Could not reach the server.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 2,
        background: 'linear-gradient(135deg, #1B3494 0%, #2F54D6 55%, #FF8A3D 150%)',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <ChalkboardBanner title="Vedha Educational Society" subtitle="School Management System" height={128} />

        <Paper elevation={6} sx={{ p: 4, mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Forgot your password?
          </Typography>

          {submitted ? (
            <>
              <Alert severity="success" sx={{ mt: 1 }}>
                If that account exists, a reset link has been sent to its email address. Open it to set a new
                password — it works once and expires soon.
              </Alert>
              <Typography variant="body2" sx={{ mt: 2 }}>
                <Link component={RouterLink} to="/login">
                  Back to login
                </Link>
              </Typography>
            </>
          ) : (
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Enter your username or the email on your account, and we'll send a link to reset your password.
              </Typography>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Username or email"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                required
                autoFocus
              />
              <Button type="submit" variant="contained" size="large" disabled={submitting || !usernameOrEmail}>
                {submitting ? 'Sending…' : 'Send reset link'}
              </Button>
              <Typography variant="body2" sx={{ textAlign: 'center' }}>
                <Link component={RouterLink} to="/login">
                  Back to login
                </Link>
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
