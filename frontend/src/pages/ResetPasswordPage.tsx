import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Link, Paper, TextField, Typography } from '@mui/material';
import { confirmPasswordReset } from '../api/auth';
import { ChalkboardBanner } from '../illustrations/SchoolIllustrations';
import { firstApiError } from '../utils/apiError';

export function ResetPasswordPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!uid || !token) return;
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await confirmPasswordReset(uid, token, newPassword);
      setDone(true);
    } catch (err) {
      setError(firstApiError(err, 'This reset link is invalid or has expired.'));
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
            Set a new password
          </Typography>

          {done ? (
            <>
              <Alert severity="success" sx={{ mt: 1 }}>
                Password updated. You can now log in with your new password.
              </Alert>
              <Button
                variant="contained"
                size="large"
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => navigate('/login')}
              >
                Go to login
              </Button>
            </>
          ) : (
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {error && <Alert severity="error">{error}</Alert>}
              {!uid || !token ? (
                <Alert severity="error">
                  This reset link looks incomplete. Request a new one from{' '}
                  <Link component={RouterLink} to="/forgot-password">
                    the forgot password page
                  </Link>
                  .
                </Alert>
              ) : (
                <>
                  <TextField
                    label="New password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <TextField
                    label="Confirm new password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    error={mismatch}
                    helperText={mismatch ? 'Passwords do not match.' : ' '}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={submitting || !newPassword || !confirmPassword || mismatch}
                  >
                    {submitting ? 'Saving…' : 'Reset password'}
                  </Button>
                </>
              )}
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
