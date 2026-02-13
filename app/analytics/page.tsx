'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card } from '@/components/ui/card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';

type Workspace = { id: number; name: string };

type AnalyticsPayload = {
  workspace_stats?: {
    team_members: number;
    total_projects: number;
    total_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    todo_tasks: number;
  };
  task_stats?: Array<{ status: string; count: number; percentage: number }>;
  priority_distribution?: Array<{ name: string; value: number }>;
  completion_trend?: Array<{ date: string; completed: number }>;
  team_performance?: Array<{
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    completed_tasks: number;
    in_progress_tasks: number;
    total_assigned_tasks: number;
  }>;
  milestones?: Array<{
    id: number;
    title: string;
    due_date: string;
    status: string;
    progress_percentage: number;
    project_name?: string;
  }>;
  completed_projects?: Array<{ name: string; description: string; status: string }>;
};

const authFetcher = async (url: string) => {
  const token = sessionStorage.getItem('auth_token');
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return res.json();
};

const priorityColors: Record<string, string> = {
  low: '#3B82F6',
  medium: '#FCD34D',
  high: '#F97316',
  urgent: '#EF4444',
};

const pretty = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function AnalyticsContent() {
  const { user } = useAuth();
  const { data: workspaces } = useSWR<Workspace[]>('/api/workspaces', authFetcher);
  const workspaceList = useMemo(() => workspaces || [], [workspaces]);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [timeRangeDays, setTimeRangeDays] = useState<number>(42);

  useEffect(() => {
    const stored = localStorage.getItem('active_workspace_id');
    if (stored) {
      setActiveWorkspaceId(stored);
      return;
    }
    if (workspaceList.length > 0) setActiveWorkspaceId(String(workspaceList[0].id));
  }, [workspaceList]);

  useEffect(() => {
    if (activeWorkspaceId) localStorage.setItem('active_workspace_id', activeWorkspaceId);
  }, [activeWorkspaceId]);

  const analyticsKey =
    activeWorkspaceId ? `/api/analytics?workspaceId=${activeWorkspaceId}&type=all&days=${timeRangeDays}` : null;

  const { data: analytics, error: analyticsError, isLoading: analyticsLoading } = useSWR<AnalyticsPayload>(
    analyticsKey,
    authFetcher
  );

  const completionTrendData = useMemo(() => {
    const rows = analytics?.completion_trend || [];
    return rows.map((r) => ({
      date: r.date,
      completed: Number(r.completed || 0),
      planned: 0,
    }));
  }, [analytics]);

  const priorityDistribution = useMemo(() => {
    const rows = analytics?.priority_distribution || [];
    return rows.map((r) => ({
      name: pretty(String(r.name || '')),
      value: Number(r.value || 0),
      color: priorityColors[String(r.name || '').toLowerCase()] || '#6B7280',
    }));
  }, [analytics]);

  const teamProductivity = useMemo(() => {
    const rows = analytics?.team_performance || [];
    return rows.map((r) => ({
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email,
      completed: Number(r.completed_tasks || 0),
      inProgress: Number(r.in_progress_tasks || 0),
      todo: Math.max(0, Number(r.total_assigned_tasks || 0) - Number(r.completed_tasks || 0) - Number(r.in_progress_tasks || 0)),
    }));
  }, [analytics]);

  const milestoneProgress = useMemo(() => {
    const rows = analytics?.milestones || [];
    return rows.map((m) => ({
      name: m.title,
      progress: Number(m.progress_percentage || 0),
      target: 100,
    }));
  }, [analytics]);

  const stats = useMemo(() => {
    const ws = analytics?.workspace_stats;
    const total = ws?.total_tasks || 0;
    const completed = ws?.completed_tasks || 0;
    const inProgress = ws?.in_progress_tasks || 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return [
      {
        label: 'Completion Rate',
        value: `${completionRate}%`,
        change: '',
        icon: CheckCircle2,
        color: 'from-accent to-teal-600',
      },
      {
        label: 'Tasks Completed',
        value: String(completed),
        change: '',
        icon: TrendingUp,
        color: 'from-blue-500 to-blue-600',
      },
      {
        label: 'In Progress',
        value: String(inProgress),
        change: '',
        icon: Clock,
        color: 'from-yellow-500 to-yellow-600',
      },
      {
        label: 'Team Members',
        value: String(ws?.team_members || 0),
        change: '',
        icon: Users,
        color: 'from-purple-500 to-purple-600',
      },
    ];
  }, [analytics]);

  // Pitch Deck Generation
  const [isGeneratingDeck, setIsGeneratingDeck] = useState(false);

  const handleGeneratePitchDeck = async () => {
    setIsGeneratingDeck(true);
    try {
      // 1. Get AI Content
      const res = await fetch('/api/ai/pitch-deck', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          workspaceName: workspaceList.find(w => String(w.id) === activeWorkspaceId)?.name || 'My Startup',
          milestones: analytics?.completed_projects || [],
        }),
      });

      if (!res.ok) throw new Error('Failed to generate content');
      const data = await res.json();

      // 2. Generate PDF (Lazy load jspdf)
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      // Styling
      const primaryColor = '#3B82F6';

      // Title
      doc.setFontSize(24);
      doc.setTextColor(primaryColor);
      doc.text('Startup Pitch Deck', 20, 20);

      doc.setFontSize(14);
      doc.setTextColor('#666666');
      doc.text(`Generatd for: ${workspaceList.find(w => String(w.id) === activeWorkspaceId)?.name}`, 20, 30);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 38);

      let yPos = 50;
      const addSection = (title: string, body: string) => {
        if (yPos > 250) { doc.addPage(); yPos = 20; }

        doc.setFontSize(16);
        doc.setTextColor(primaryColor);
        doc.text(title.toUpperCase(), 20, yPos);
        yPos += 10;

        doc.setFontSize(12);
        doc.setTextColor('#000000');
        const splitText = doc.splitTextToSize(body, 170);
        doc.text(splitText, 20, yPos);
        yPos += (splitText.length * 7) + 15;
      };

      addSection('The Problem', data.problem || 'N/A');
      addSection('The Solution', data.solution || 'N/A');
      addSection('Market Opportunity', data.market || 'N/A');
      addSection('Traction & Milestones', data.traction || 'N/A');
      addSection('Team', data.team || 'N/A');

      // Save
      doc.save('pitch-deck.pdf');

    } catch (err) {
      console.error(err);
      alert('Failed to generate pitch deck. Please try again.');
    } finally {
      setIsGeneratingDeck(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />

      <main className="w-full md:pl-64 p-4 md:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Analytics
            </h1>
            <p className="text-muted-foreground">
              Track your team's performance and project progress
            </p>
          </div>
          <button
            onClick={handleGeneratePitchDeck}
            disabled={isGeneratingDeck}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 font-medium shadow-lg"
          >
            {isGeneratingDeck ? (
              <>Generating...</>
            ) : (
              <>
                <span>✨ Generate Pitch Deck PDF</span>
              </>
            )}
          </button>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-6">
          <div className="relative">
            <select
              value={activeWorkspaceId}
              onChange={(e) => setActiveWorkspaceId(e.target.value)}
              className="h-10 pl-3 pr-10 rounded-lg border border-input bg-background text-foreground"
              disabled={workspaceList.length === 0}
            >
              {workspaceList.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <select
              value={String(timeRangeDays)}
              onChange={(e) => setTimeRangeDays(Number(e.target.value))}
              className="h-10 pl-3 pr-10 rounded-lg border border-input bg-background text-foreground"
            >
              <option value="14">Last 14 days</option>
              <option value="42">Last 42 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </div>

        {(analyticsLoading || analyticsError) && (
          <Card className="p-6 mb-8">
            {analyticsLoading ? (
              <p className="text-sm text-muted-foreground">Loading analytics…</p>
            ) : (
              <p className="text-sm text-muted-foreground">{(analyticsError as Error).message}</p>
            )}
          </Card>
        )}

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
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
                <Card className="overflow-hidden">
                  <div className={`bg-gradient-to-br ${stat.color} p-4 text-white`}>
                    <Icon className="w-8 h-8 opacity-80" />
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground mb-1">
                      {stat.label}
                    </p>
                    <div className="flex justify-between items-end">
                      <p className="text-3xl font-bold text-foreground">
                        {stat.value}
                      </p>
                      <p className="text-sm text-accent font-semibold">
                        {stat.change}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Charts Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
        >
          {/* Completion Trend */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Completion Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={completionTrendData}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="var(--accent)"
                  fillOpacity={1}
                  fill="url(#colorCompleted)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Priority Distribution */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Task Priority Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={priorityDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {priorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Team Productivity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Team Productivity Scores
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={teamProductivity}>
                <CartesianGrid stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="completed"
                  fill="var(--accent)"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="inProgress"
                  fill="var(--primary)"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="todo"
                  fill="var(--secondary)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Milestone Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">
              Milestone Progress
            </h3>
            <div className="space-y-6">
              {milestoneProgress.map((milestone, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-foreground">
                      {milestone.name}
                    </h4>
                    <span className="text-sm font-semibold text-primary">
                      {milestone.progress}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${milestone.progress}%` }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 1 }}
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                    ></motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute requiredRole="manager">
      <AnalyticsContent />
    </ProtectedRoute>
  );
}
