import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Link, Paper, TextField, Typography } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { ChalkboardBanner } from '../illustrations/SchoolIllustrations';
import type { AxiosError } from 'axios';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      const axiosErr = err as AxiosError;
      setError(axiosErr.response?.status === 401 ? 'Invalid username or password.' : 'Could not reach the server.');
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
            Sign in to continue
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Log in'}
            </Button>
            <Typography variant="body2" sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/forgot-password">
                Forgot password?
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
