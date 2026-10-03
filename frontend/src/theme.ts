import { alpha, createTheme } from '@mui/material/styles';

const FONT_FAMILY = "system-ui, 'Segoe UI', Roboto, sans-serif";

// A warm, energetic "school ERP" palette — a lively academic blue paired
// with a chalk-orange accent, on a soft warm-white background instead of
// stark white/grey, so the app feels less like a bare admin panel and more
// like an actual school system.
const PRIMARY = '#2F54D6';
const PRIMARY_DARK = '#1B3494';
const SECONDARY = '#FF8A3D';
const BACKGROUND = '#F5F7FC';

export const theme = createTheme({
  palette: {
    primary: { main: PRIMARY, dark: PRIMARY_DARK },
    secondary: { main: SECONDARY },
    background: { default: BACKGROUND, paper: '#FFFFFF' },
    success: { main: '#2E9E5B' },
    warning: { main: '#F2A900' },
    info: { main: '#2E9BD6' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: FONT_FAMILY,
    h1: { fontFamily: FONT_FAMILY, fontWeight: 600 },
    h2: { fontFamily: FONT_FAMILY, fontWeight: 600 },
    h3: { fontFamily: FONT_FAMILY, fontWeight: 600 },
    h4: { fontFamily: FONT_FAMILY, fontWeight: 700 },
    h5: { fontFamily: FONT_FAMILY, fontWeight: 600 },
    h6: { fontFamily: FONT_FAMILY, fontWeight: 600 },
    subtitle1: { fontFamily: FONT_FAMILY, fontWeight: 600 },
    subtitle2: { fontFamily: FONT_FAMILY, fontWeight: 600 },
    body1: { fontFamily: FONT_FAMILY },
    body2: { fontFamily: FONT_FAMILY },
    caption: { fontFamily: FONT_FAMILY },
    button: { fontFamily: FONT_FAMILY, fontWeight: 600 },
  },
  components: {
    // A central density knob for every Card-based grid (Dashboard stat
    // cards, etc.) — cuts the vertical space each card takes without
    // touching individual pages.
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 12,
          '&:last-child': { paddingBottom: 12 },
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        toolbar: {
          minHeight: '40px !important',
          paddingTop: 0,
          paddingBottom: 0,
        },
      },
    },
    // The colorful gradient header banner every page sits under.
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: `linear-gradient(120deg, ${PRIMARY_DARK} 0%, ${PRIMARY} 55%, ${SECONDARY} 150%)`,
          boxShadow: '0 2px 10px rgba(27, 52, 148, 0.25)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: { borderColor: alpha(PRIMARY, 0.18) },
      },
    },
    // Table headers get a light tint of the primary color app-wide instead
    // of plain grey/white, so every data table (Classes, Sections, Rooms,
    // Students, ...) picks this up automatically.
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            backgroundColor: alpha(PRIMARY, 0.07),
            fontWeight: 700,
            color: PRIMARY_DARK,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 8 },
        contained: { boxShadow: 'none' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    // Sidebar nav items: rounded, with a soft tinted highlight instead of
    // the default flat grey selected state.
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginLeft: 8,
          marginRight: 8,
          marginBottom: 2,
          '&.Mui-selected': {
            backgroundColor: alpha(PRIMARY, 0.12),
            '&:hover': { backgroundColor: alpha(PRIMARY, 0.16) },
          },
          '&.Mui-selected .MuiListItemText-primary': {
            color: PRIMARY_DARK,
            fontWeight: 700,
          },
        },
      },
    },
  },
});
