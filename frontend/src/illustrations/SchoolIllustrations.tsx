import { Box, Typography } from '@mui/material';

// Small inline school-building + flag mark used in the header bar. Uses
// currentColor so it automatically matches whatever text color it's placed
// in (white on the gradient AppBar, dark elsewhere) — no image file, no
// network request, scales crisply at any size.
export function SchoolMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 40h36" />
      <path d="M10 40V20l14-8 14 8v20" />
      <path d="M20 40V28h8v12" />
      <path d="M24 12V6" />
      <path d="M24 6h8l-8 6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// A decorative "blackboard" banner — a chalk-green board in a wooden frame
// with simple chalk-drawn doodles (books, an apple, a pencil, a ruler,
// scattered stars), and the page title/subtitle rendered as chalk-white
// text over it. Used at the top of pages that asked for a "school
// environment" look (Classes & Sections) and on the Login page.
export function ChalkboardBanner({
  title,
  subtitle,
  height = 132,
}: {
  title: string;
  subtitle?: string;
  height?: number;
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        height,
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
      }}
    >
      <svg
        viewBox="0 0 800 200"
        preserveAspectRatio="xMidYMid slice"
        width="100%"
        height="100%"
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        <rect x="4" y="4" width="792" height="192" rx="14" fill="#1F3B2C" stroke="#8B5A2B" strokeWidth="10" />
        <rect x="20" y="176" width="760" height="8" rx="4" fill="#8B5A2B" />

        {/* book stack, bottom-left */}
        <g stroke="#F4EFE1" strokeWidth="2.5" fill="none" opacity="0.85">
          <rect x="36" y="122" width="72" height="15" rx="2" />
          <rect x="42" y="107" width="62" height="15" rx="2" />
          <rect x="48" y="92" width="52" height="15" rx="2" />
        </g>

        {/* apple, top-right */}
        <g stroke="#F4EFE1" strokeWidth="2.5" fill="none" opacity="0.85">
          <circle cx="706" cy="66" r="20" />
          <path d="M706 46 q4 -10 12 -12" />
          <path d="M714 38 q9 -2 11 7" />
        </g>

        {/* pencil, bottom-right */}
        <g stroke="#F4EFE1" strokeWidth="2.5" fill="none" opacity="0.85" transform="rotate(-28 650 140)">
          <rect x="618" y="131" width="62" height="15" rx="3" />
          <path d="M680 131 l15 7.5 l-15 7.5 z" />
        </g>

        {/* ruler, top-mid-right */}
        <g stroke="#F4EFE1" strokeWidth="2" fill="none" opacity="0.6">
          <rect x="580" y="28" width="150" height="16" rx="2" transform="rotate(9 655 36)" />
        </g>

        {/* scattered chalk stars */}
        <g fill="#FFD782" opacity="0.9">
          <circle cx="150" cy="38" r="2.5" />
          <circle cx="182" cy="58" r="2" />
          <circle cx="470" cy="28" r="2.5" />
          <circle cx="508" cy="50" r="2" />
          <circle cx="380" cy="170" r="2" />
        </g>
      </svg>

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: { xs: 2.5, sm: 4 },
        }}
      >
        <Typography
          variant="h4"
          sx={{ color: '#F4EFE1', textShadow: '0 2px 6px rgba(0,0,0,0.35)', lineHeight: 1.15 }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'rgba(244,239,225,0.85)', mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
