import { Box, Paper, Typography } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/ConstructionOutlined';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <ConstructionIcon fontSize="large" color="disabled" />
      </Box>
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary">
        This module's UI is coming in a later pass. The backend API for it is already live.
      </Typography>
    </Paper>
  );
}
