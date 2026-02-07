'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import useSWR from 'swr';
import { useMemo } from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';

const authFetcher = async (url: string) => {
  const token = sessionStorage.getItem('auth_token');
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Request failed');
  }
  return res.json();
};

const statusIcons: Record<string, any> = {
  todo: <Circle className="w-4 h-4 text-gray-400" />,
  in_progress: <Clock className="w-4 h-4 text-blue-500" />,
  in_review: <AlertCircle className="w-4 h-4 text-purple-500" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
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
              <p className="text-xs text-muted-foreground">{m.job_title || m.role}</p>
            </div>
          </div>
          {/* Equity Badge intentionally omitted for employees */}
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

function EmployeeDashboardContent() {
  const { user } = useAuth();

  // Fetch tasks assigned to this user
  // Note: We need a workspaceId context, but for now we'll fetch from the active one or first available
  // To keep it simple for this "differentiation" task, we'll try to get all assigned tasks if the API supports it without workspace
  // But our API requires workspaceId. Let's try to get it from local storage or fetch workspaces first.

  const { data: workspaces } = useSWR('/api/workspaces', authFetcher);
  const activeWorkspaceId = workspaces?.[0]?.id; // Default to first for now

  const tasksKey = user && activeWorkspaceId
    ? `/api/tasks?workspaceId=${activeWorkspaceId}&assigned_to=${user.id}`
    : null;

  const { data: tasks, error } = useSWR(tasksKey, authFetcher);

  const myTasks = useMemo(() => Array.isArray(tasks) ? tasks : [], [tasks]);

  const stats = useMemo(() => {
    return {
      total: myTasks.length,
      completed: myTasks.filter((t: any) => t.status === 'completed').length,
      pending: myTasks.filter((t: any) => t.status !== 'completed').length
    };
  }, [myTasks]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <main className="w-full md:pl-64 p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-foreground mb-2">Welcome, {user?.first_name}! 👋</h1>
          <p className="text-muted-foreground">Here are your assigned tasks for today.</p>
        </motion.div>

        {/* Personal Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Assigned to Me</h3>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">{stats.total}</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <h3 className="text-sm font-medium text-green-800 dark:text-green-200">Completed</h3>
            <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-2">{stats.completed}</p>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Pending</h3>
            <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100 mt-2">{stats.pending}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* My Tasks List */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Tasks Widget */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">My Active Tasks</h2>
                <Link href="/tasks">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>

              <div className="space-y-3">
                {myTasks.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    <p>No tasks assigned yet. 🌴</p>
                  </Card>
                ) : (
                  myTasks.slice(0, 5).map((task: any) => (
                    <Card key={task.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{statusIcons[task.status] || <Circle className="w-4 h-4" />}</div>
                        <div>
                          <h4 className="font-medium text-foreground">{task.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                              task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                              {task.priority}
                            </span>
                            {task.due_date && (
                              <span className="text-[10px] text-muted-foreground">
                                Due: {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Recent Milestones (View Only) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">Upcoming Milestones</h2>
              </div>
              <Card className="p-6">
                <MilestoneList workspaceId={activeWorkspaceId} />
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link href="/tasks" className="block">
                  <Button className="w-full justify-start" variant="outline">
                    <Clock className="w-4 h-4 mr-2" /> Log Work
                  </Button>
                </Link>
                <Link href="/chat" className="block">
                  <Button className="w-full justify-start" variant="outline">
                    <AlertCircle className="w-4 h-4 mr-2" /> Report Issue
                  </Button>
                </Link>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Team</h3>
              <TeamList workspaceId={activeWorkspaceId} />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function EmployeeDashboardPage() {
  return (
    <ProtectedRoute requiredRole="employee">
      <EmployeeDashboardContent />
    </ProtectedRoute>
  );
}
