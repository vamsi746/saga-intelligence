import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useRbac } from '../contexts/RbacContext';
import AccessDenied from './AccessDenied';
import {
  Shield, LayoutDashboard, Rss, AlertTriangle, BarChart3,
  Settings, FileText, LogOut, Menu, X, Moon, Sun, ChevronRight, HelpCircle, Youtube, Twitter, Facebook, Instagram, Globe, CalendarDays, BellOff, MessageSquare, PhoneCall, Monitor, UserSearch, Scan, Search
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const Layout = () => {
  const { user, logout } = useAuth();
  const { hasAccess, normalizeRoutePath, loading: rbacLoading } = useRbac();
  const { unreadCount, markAllRead } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive breakpoints
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // On desktop, sidebar should be open by default
      if (!mobile) {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar on route change (mobile only)
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, sidebarOpen]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const allNavigation = [
    { name: 'Dashboard', href: '/punjab-map', icon: Globe },
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Grievances', href: '/grievances', icon: MessageSquare },
    { name: 'Alerts', href: '/alerts', icon: AlertTriangle },
    // { name: 'Reports', href: '/reports', icon: FileText },
    // { name: 'Sources', href: '/sources', icon: Rss },
    { name: 'SM Handles', href: '/monitors', icon: Monitor },
    //{ name: 'YouTube Monitor', href: '/youtube-monitor', icon: Youtube },
    //{ name: 'X Monitor', href: '/x-monitor', icon: Twitter },
    //{ name: 'Facebook Monitor', href: '/facebook-monitor', icon: Facebook },
    //{ name: 'Instagram Monitor', href: '/instagram-monitor', icon: Instagram },
    { name: 'Events', href: '/events', icon: CalendarDays },
    { name: 'Global Search', href: '/global-search', icon: Globe },
    //{ name: 'Intelligence', href: '/intelligence-dashboard', icon: BarChart3 },
    { name: 'Profile', href: '/person-of-interest', icon: UserSearch },
    //{ name: 'Policy Manager', href: '/policies', icon: Shield },
    //{ name: 'Policy Manager', href: '/policies', icon: Shield },
    { name: 'Deepfake Analysis', href: '/deepfake-analysis', icon: Scan },
    { name: 'Access Management', href: '/access-management', icon: Shield, roles: ['superadmin'] },
    //{ name: 'Telegram', href: '/telegram', icon: MessageSquare },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Help Guide', href: '/help', icon: HelpCircle },

  ];

  const roleFilteredNavigation = user?.role === 'dial100'
    ? allNavigation.filter((item) => item.href === '/dial-100-incident-reporting')
    : allNavigation.filter((item) => !item.roles || item.roles.includes(user?.role));
  const navigation = roleFilteredNavigation.filter((item) => hasAccess(item.href));

  const normalizedPath = normalizeRoutePath(location.pathname);
  const isRouteAllowed = location.pathname === '/' || hasAccess(normalizedPath);
  const showAccessDenied = !rbacLoading && !isRouteAllowed;

  const isFullWidthPage = (location.pathname.includes('/person-of-interest/') && location.pathname.split('/').length > 2) ||
    location.pathname.startsWith('/reports/generate/') ||
    location.pathname === '/sources' ||
    location.pathname === '/telegram' ||
    location.pathname === '/settings';

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden relative print:h-auto print:overflow-visible">
      {/* Mobile Overlay Backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Top Bar - GOV themed with professional navy */}
      <header className="fixed top-0 left-0 right-0 h-16 lg:h-20 bg-gradient-to-r from-[hsl(217,71%,18%)] via-[hsl(217,71%,22%)] to-[hsl(217,71%,18%)] border-b-2 lg:border-b-4 border-[hsl(43,96%,50%)] z-50 shadow-lg">
        <div className="flex items-center justify-between h-full px-4 lg:px-6">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-3 lg:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="sidebar-toggle-btn"
              className="text-white hover:bg-white/10 h-10 w-10 lg:h-11 lg:w-11"
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            >
              {sidebarOpen ? <X className="h-5 w-5 lg:h-6 lg:w-6" /> : <Menu className="h-5 w-5 lg:h-6 lg:w-6" />}
            </Button>

            <div className="flex items-center gap-3 lg:gap-4">
              <div className="relative">
                <img
                  src="/policelogo.jpg"
                  alt="Logo"
                  className="h-10 w-10 lg:h-14 lg:w-14 rounded-full object-cover border-2 lg:border-3 border-[hsl(43,96%,50%)] shadow-lg ring-2 ring-white/20"
                />
                <div className="absolute -bottom-0.5 -right-0.5 lg:-bottom-1 lg:-right-1 w-3 h-3 lg:w-4 lg:h-4 bg-green-500 rounded-full border-2 border-white"></div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg lg:text-2xl font-heading font-bold text-white tracking-wider uppercase">BLURA - SAGA FOR PUNJAB GOVERNMENT</h1>
                <span className="hidden sm:block text-[10px] lg:text-xs text-[hsl(43,96%,70%)] font-medium tracking-widest uppercase">Sentiment and Goodwill Analysis</span>
              </div>
            </div>
          </div>

          {/* Right: Theme + User */}
          <div className="flex items-center gap-2 lg:gap-4">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  try {
                    await markAllRead();
                    toast.success('Notifications cleared');
                  } catch {
                    toast.error('Failed to clear notifications');
                  }
                }}
                data-testid="clear-all-notifications-btn"
                className="text-white hover:bg-white/10 h-9 w-9 lg:h-10 lg:w-10"
                aria-label="Clear all notifications"
              >
                <BellOff className="h-4 w-4 lg:h-5 lg:w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              data-testid="theme-toggle-btn"
              className="text-white hover:bg-white/10 h-9 w-9 lg:h-10 lg:w-10"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="h-4 w-4 lg:h-5 lg:w-5 text-[hsl(43,96%,70%)]" /> : <Moon className="h-4 w-4 lg:h-5 lg:w-5" />}
            </Button>

            <div className="hidden sm:block h-6 lg:h-8 w-px bg-white/20"></div>

            <div className="flex items-center gap-2 lg:gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs lg:text-sm font-semibold text-white truncate max-w-[120px] lg:max-w-none">{user?.full_name}</div>
                <div className="text-[10px] lg:text-xs text-[hsl(43,96%,70%)] font-medium uppercase tracking-wide">{user?.role}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                data-testid="logout-btn"
                className="text-white hover:bg-red-500/20 hover:text-red-300 h-9 w-9 lg:h-10 lg:w-10"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4 lg:h-5 lg:w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar - Responsive with overlay on mobile */}
      <aside
        className={`fixed top-16 lg:top-20 left-0 bottom-0 w-72 lg:w-72 bg-white dark:bg-slate-950 border-r border-border shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        data-testid="sidebar"
        role="navigation"
        aria-label="Main navigation"
      >


        {/* Navigation Links */}
        <nav className="p-6 lg:p-4 space-y-1 lg:space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                className={`flex items-center gap-3 px-3 lg:px-4 py-3 lg:py-3 rounded-lg text-sm font-semibold transition-all duration-200 min-h-[44px] ${isActive
                  ? 'bg-secondary text-primary shadow-md shadow-secondary/25 scale-[1.02]'
                  : 'text-foreground hover:bg-muted hover:translate-x-1'
                  }`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="flex-1">{item.name}</span>
                {item.name === 'Alerts' && unreadCount > 0 && (
                  <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mr-2">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {isActive && <ChevronRight className="h-4 w-4 text-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer Status */}
        <div className="absolute bottom-0 left-0 right-0 bg-card border-t border-border">

          <div className="pt-3 border-t border-border/50">
            <p className="text-[18px] text-muted-foreground text-center mb-1">Powered by</p>
            <div className="flex items-center justify-center">
              <img src="/Logo.png" alt="BCSS Logo" className="h-19 w-auto object-contain" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col min-h-0 pt-16 lg:pt-20 transition-all duration-300 print:pt-0 print:pl-0 print:h-auto print:overflow-visible ${sidebarOpen && !isMobile ? 'lg:pl-72' : 'pl-0'
          }`}
      >
        <main className={`flex-1 min-h-0 ${isFullWidthPage ? 'p-0' : 'p-4 lg:p-8'} overflow-auto print:h-auto print:overflow-visible`}>
          {showAccessDenied ? <AccessDenied /> : <Outlet />}
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-white dark:bg-slate-950 px-4 lg:px-8 py-3 lg:py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>© 2026 BLURA - SAGA</span>
            <span className="flex items-center gap-2 text-secondary">
              <Shield className="h-3 w-3" />
              Authorized Personnel Only
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
