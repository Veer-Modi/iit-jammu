'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import useSWR from 'swr';
import {
  LayoutDashboard,
  Building2,
  Folder,
  ListTodo,
  MessageCircle,
  Target,
  Users,
  Settings,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { io as ClientIO } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navigationItems = [
  {
    label: 'Workspaces',
    href: '/workspaces',
    icon: Building2,
    roles: ['admin', 'manager', 'employee'],
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: Folder,
    roles: ['admin', 'manager', 'employee'],
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'employee'],
  },
  {
    label: 'Tasks',
    href: '/tasks',
    icon: ListTodo,
    roles: ['admin', 'manager', 'employee'],
  },
  {
    label: 'Milestones',
    href: '/milestones',
    icon: Target,
    roles: ['admin', 'manager', 'employee'],
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: MessageCircle,
    roles: ['admin', 'manager', 'employee'],
  },
  {
    label: 'Team',
    href: '/team',
    icon: Users,
    roles: ['admin', 'manager'],
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    roles: ['admin', 'manager'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin', 'manager', 'employee'],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => {
      setIsDesktop(media.matches);
      if (media.matches) {
        setIsOpen(true);
      }
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // Fetch unread count for Chat (sessionStorage to match useAuth)
  const fetcher = (url: string) => {
    const token = sessionStorage.getItem('auth_token');
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());
  };
  const { data: unreadData, mutate: mutateUnread } = useSWR('/api/chat/unread-count', fetcher, { refreshInterval: 5000 });
  const unreadCount = unreadData?.total_unread || 0;

  useEffect(() => {
    if (!user?.id) return;
    const socket = ClientIO(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000', {
      path: '/api/socket/io',
      addTrailingSlash: false,
    });

    socket.on('connect', () => {
      socket.emit('join-user', user.id);
    });

    socket.on('notification', () => {
      mutateUnread();
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id, mutateUnread]);

  const filteredItems = navigationItems.filter(
    (item) => !user || item.roles.includes(user.role)
  );

  return (
    <>
      {/* Mobile Menu Button */}
      {!isDesktop && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden fixed top-4 left-4 z-40 p-2 hover:bg-secondary rounded-lg transition-smooth"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {!isDesktop && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="md:hidden fixed inset-0 bg-black/50 z-30"
          ></motion.div>
        )}
      </AnimatePresence>

      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-card border-r border-border p-6 flex flex-col z-40 transition-transform duration-300 ${isDesktop || isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center group-hover:shadow-lg transition-smooth">
              <span className="text-lg font-bold text-white">TF</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">TaskFlow</h1>
              <p className="text-xs text-muted-foreground">
                {user?.role === 'admin' ? 'Founder Workspace' : 'Employee Workspace'}
              </p>
            </div>
          </Link>
        </motion.div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">

          {filteredItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Link
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-smooth group relative overflow-hidden ${isActive
                    ? 'bg-primary text-white shadow-lg'
                    : 'text-foreground hover:bg-secondary'
                    }`}
                >
                  {/* Background glow on active */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-primary -z-10"
                      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                    ></motion.div>
                  )}

                  <div className="relative">
                    <Icon className={`w-5 h-5 ${isActive ? 'animate-bounce' : ''}`} />
                    {/* Chat Unread Badge */}
                    {item.label === 'Chat' && unreadCount > 0 && (
                      <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-card">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="font-medium">{item.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* User Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="pt-6 border-t border-border space-y-3"
        >
          <div className="px-2">
            <p className="text-sm font-semibold text-foreground truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full justify-start gap-2 btn-hover-lift bg-transparent"
            onClick={() => {
              logout();
              router.push('/auth/login');
              if (!isDesktop) setIsOpen(false);
            }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </motion.div>
      </aside>
    </>
  );
}
