import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../auth/AuthContext';
import { SchoolMark } from '../illustrations/SchoolIllustrations';
import { navItems } from './navConfig';

const DRAWER_WIDTH = 260;

// Cycled across the sidebar's nav icons (not tied to any specific item) so
// the list reads as more than one flat monochrome column — purely a look
// change, doesn't affect what each item does.
const NAV_ICON_COLORS = ['primary.main', 'secondary.main', 'success.main', 'info.main', 'warning.main'] as const;

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const visibleItems = navItems.filter((item) => !item.roles || (user?.role_name && item.roles.includes(user.role_name)));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawerContent = (
    <>
      <Box
        sx={{
          m: 1.5,
          mb: 1,
          p: 1.5,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
          color: 'primary.dark',
        }}
      >
        <SchoolMark size={26} />
        <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
          Vedha Educational Society
        </Typography>
      </Box>
      <List>
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const selected = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.path}
              selected={selected}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
            >
              <ListItemIcon>
                <Icon sx={{ color: selected ? 'primary.main' : NAV_ICON_COLORS[index % NAV_ICON_COLORS.length] }} />
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen((open) => !open)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexGrow: 1 }}>
            <SchoolMark size={28} />
            <Typography variant="h6" noWrap>
              Vedha Educational Society
            </Typography>
          </Box>
          <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ p: 0 }}>
            <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>
              {(user?.first_name?.[0] ?? user?.username?.[0] ?? '?').toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem disabled>{user?.username} ({user?.role_name ?? 'no role'})</MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        <Toolbar />
        {drawerContent}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: { sm: DRAWER_WIDTH },
          flexShrink: { sm: 0 },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
        open
      >
        <Toolbar />
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toolbar sx={{ flexShrink: 0 }} />
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
