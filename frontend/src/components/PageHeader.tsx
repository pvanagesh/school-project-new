import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material';

// A slim, colorful header bar used at the top of every main page so the app
// reads as one consistent, "school-colored" system rather than a mix of
// plain default-MUI pages and a couple of pages with the full illustrated
// chalkboard banner (Login, Classes & Sections). Same accent colors as the
// rest of the theme, much cheaper to add than a banner illustration, so
// every page can get it in one pass.
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ComponentType<SvgIconProps>;
  title: string;
  subtitle?: string;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        mb: 2,
        px: 2,
        py: 1.5,
        borderRadius: 2,
        background: (t) =>
          `linear-gradient(120deg, ${alpha(t.palette.primary.main, 0.14)} 0%, ${alpha(t.palette.secondary.main, 0.14)} 130%)`,
        border: '1px solid',
        borderColor: (t) => alpha(t.palette.primary.main, 0.16),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          flexShrink: 0,
        }}
      >
        <Icon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.dark', lineHeight: 1.25 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
