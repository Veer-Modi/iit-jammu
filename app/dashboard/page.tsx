'use client';

import { useAuth } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
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
  Plus,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';



// Sample data for charts
const taskData = [
  { name: 'Mon', tasks: 12, completed: 8 },
  { name: 'Tue', tasks: 19, completed: 14 },
  { name: 'Wed', tasks: 15, completed: 12 },
  { name: 'Thu', tasks: 22, completed: 18 },
  { name: 'Fri', tasks: 25, completed: 20 },
  { name: 'Sat', tasks: 8, completed: 6 },
  { name: 'Sun', tasks: 5, completed: 4 },
];

const teamData = [
  { name: 'Alice', completed: 24 },
  { name: 'Bob', completed: 19 },
  { name: 'Charlie', completed: 15 },
  { name: 'Diana', completed: 12 },
];

const statusData = [
  { name: 'Completed', value: 45, color: '#52E5A7' },
  { name: 'In Progress', value: 30, color: '#3B82F6' },
  { name: 'Todo', value: 25, color: '#FCD34D' },
];

const COLORS = ['#52E5A7', '#3B82F6', '#FCD34D'];

type Workspace = {
  id: number;
  name: string;
};

const authFetcher = async (url: string) => {
  const token = sessionStorage.getItem('auth_token');
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return res.json();
};

const TeamList = ({ workspaceId }: { workspaceId: string | null }) => {
  const { data: members } = useSWR(workspaceId ? `/api/workspace-members?workspaceId=${workspaceId}` : null, authFetcher);

  if (!members) return <div className="text-sm text-muted-foreground">Loading team...</div>;
  if (members.length === 0) return <div className="text-sm text-muted-foreground">No team members yet.</div>;

  return (
    <div className="space-y-4">
      {members.slice(0, 5).map((m: any) => (
        <div key={m.id} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
              {m.first_name[0]}{m.last_name[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{m.first_name} {m.last_name}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{m.job_title || m.role}</p>
                {/* Task Stats Pill */}
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {m.completed_tasks}/{m.total_tasks} Tasks
                </span>
              </div>
            </div>
          </div>

          {/* Equity Badge - Only visible if present */}
          {m.equity !== undefined && m.equity !== null && (
            <div className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">
              {m.equity}% Eq.
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const MilestoneList = ({ workspaceId }: { workspaceId: string | null }) => {
  const { data: milestones } = useSWR(workspaceId ? `/api/milestones?workspaceId=${workspaceId}` : null, authFetcher);

  if (!milestones) return <div className="text-sm text-muted-foreground">Loading milestones...</div>;
  if (milestones.length === 0) return <div className="text-sm text-muted-foreground">No upcoming milestones.</div>;

  return (
    <div className="space-y-4">
      {milestones.slice(0, 3).map((m: any) => (
        <div key={m.id} className="border-l-2 border-primary pl-4 py-1">
          <p className="text-sm font-medium text-foreground">{m.title}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">{new Date(m.due_date).toLocaleDateString()}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}>
              {m.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Employee redirect
  useEffect(() => {
    if (user && user.role === 'employee') {
      router.replace('/tasks');
    }
  }, [user, router]);

  // Mock workspaces - in production this would come from API
  // Replaced the static setWorkspaceId with dynamic workspace fetching and activeWorkspaceId logic
  const { data: workspaces } = useSWR<Workspace[]>('/api/workspaces', authFetcher);
  const workspaceList = useMemo(() => workspaces || [], [workspaces]);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('active_workspace_id');
    if (stored) {
      setActiveWorkspaceId(stored);
      return;
    }
    if (workspaceList.length > 0) {
      setActiveWorkspaceId(String(workspaceList[0].id));
    }
  }, [workspaceList]);

  const statsKey = activeWorkspaceId
    ? `/api/dashboard/stats?workspaceId=${activeWorkspaceId}`
    : null;
  const { data: statsData, isLoading: statsLoading } = useSWR(statsKey, authFetcher);

  const stats = [
    {
      title: 'Total Tasks',
      value: statsLoading ? '...' : statsData?.total_tasks || 0,
      icon: LayoutDashboard,
      change: '+12%',
      changeType: 'positive',
      color: 'from-blue-500 to-blue-600', // Added color back for rendering
    },
    {
      title: 'Completed',
      value: statsLoading ? '...' : statsData?.completed_tasks || 0,
      icon: CheckCircle2,
      change: '+8%',
      changeType: 'positive',
      color: 'from-accent to-teal-600', // Added color back for rendering
    },
    {
      title: 'In Progress',
      value: statsLoading ? '...' : statsData?.in_progress_tasks || 0,
      icon: Clock,
      change: '-5%',
      changeType: 'negative',
      color: 'from-purple-500 to-purple-600', // Added color back for rendering
    },
    {
      title: 'Team Members',
      value: statsLoading ? '...' : statsData?.team_members || 0,
      icon: Users,
      change: '+2',
      changeType: 'positive',
      color: 'from-orange-500 to-orange-600', // Added color back for rendering
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />

      <main className="w-full md:pl-64 p-4 md:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Welcome, Founder {user?.first_name}! 🚀
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your team today
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-3 mb-8"
        >
          <Link href="/tasks">
            <Button className="gap-2 btn-hover-lift">
              <Plus className="w-4 h-4" />
              Create New Task
            </Button>
          </Link>

          <Link href="/chat">
            <Button variant="outline" className="gap-2 btn-hover-lift bg-transparent">
              Open Chat
            </Button>
          </Link>

          <Link href="/analytics">
            <Button variant="outline" className="gap-2 btn-hover-lift bg-transparent">
              View Analytics
            </Button>
          </Link>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="overflow-hidden hover:shadow-lg transition-smooth">
                  <div className={`bg-gradient-to-br ${stat.color} p-4 text-white`}>
                    <Icon className="w-8 h-8 mb-2 opacity-80" />
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground mb-1">
                      {stat.title} {index < 3 && <span className="text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded ml-1">Private</span>}
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {stat.value}
                    </p>
                    <div className={`flex items-center gap-1 text-xs font-medium mt-2 ${stat.changeType === 'positive' ? 'text-green-500' : 'text-red-500'
                      }`}>
                      {stat.changeType === 'positive' ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                      {stat.change} from last month
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Core Team & Milestones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Core Team Widget */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Core Team</h3>
              <Button variant="outline" size="sm" className="h-8">Manage</Button>
            </div>
            <TeamList workspaceId={activeWorkspaceId} />
          </Card>

          {/* Milestones Widget */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Next Milestones</h3>
              <Button variant="outline" size="sm" className="h-8">View All</Button>
            </div>
            <MilestoneList workspaceId={activeWorkspaceId} />
          </Card>
        </div>

        {/* Charts Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
        >
          {/* Tasks Over Time */}
          <Card className="lg:col-span-2 p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Tasks Overview
              </h3>
              <p className="text-sm text-muted-foreground">
                Tasks created vs completed
              </p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={taskData}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: `1px solid var(--border)`,
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="tasks"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--primary)', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--accent)', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Task Status Distribution */}
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Status Distribution
              </h3>
              <p className="text-sm text-muted-foreground">Current breakdown</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: `1px solid var(--border)`,
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Team Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 gap-6"
        >
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Team Performance
              </h3>
              <p className="text-sm text-muted-foreground">
                Completed tasks per team member this week
              </p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teamData}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: `1px solid var(--border)`,
                    borderRadius: '8px',
                  }}
                />
                <Bar
                  dataKey="completed"
                  fill="var(--primary)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <DashboardContent />
    </ProtectedRoute>
  );
}
