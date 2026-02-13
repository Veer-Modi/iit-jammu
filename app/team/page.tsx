'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Users, ChevronDown, UserPlus, Loader2, Search, CheckCircle2, Clock, Circle, LayoutList, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

type Workspace = { id: number; name: string };

type WorkspaceMember = {
  id: number;
  workspace_id: number;
  user_id: number;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  designation?: string;
  joined_at: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  app_role: 'admin' | 'manager' | 'employee';
  completed_tasks?: number;
  total_tasks?: number;
};

type CreatedEmployee = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'employee';
  designation?: string;
  temporary_password: string;
};

type TaskDetail = {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  project_name: string;
  workspace_name: string;
  due_date?: string;
  created_at: string;
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

const EmployeeDetailsSheet = ({
  member,
  workspaceId,
  isOpen,
  onClose
}: {
  member: WorkspaceMember | null,
  workspaceId: string,
  isOpen: boolean,
  onClose: () => void
}) => {
  const { data: tasks, isLoading } = useSWR<TaskDetail[]>(
    member && isOpen && workspaceId ? `/api/tasks?assigned_to=${member.user_id}&workspaceId=${workspaceId}` : null,
    authFetcher
  );

  const taskList = useMemo(() => tasks || [], [tasks]);

  const stats = useMemo(() => {
    return {
      completed: taskList.filter(t => t.status === 'completed').length,
      itemInProgress: taskList.filter(t => t.status === 'in_progress').length,
      pending: taskList.filter(t => t.status === 'todo' || t.status === 'in_review').length,
      total: taskList.length
    };
  }, [taskList]);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-xl w-full">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold">
              {member?.first_name?.[0]}{member?.last_name?.[0]}
            </div>
            <div>
              <p className="text-xl">{member?.first_name} {member?.last_name}</p>
              <p className="text-sm font-normal text-muted-foreground">{member?.designation || 'Member'}</p>
            </div>
          </SheetTitle>
          <SheetDescription>
            Performance Overview & Task History
          </SheetDescription>
        </SheetHeader>

        {member && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-800">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.completed}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">In Progress</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.itemInProgress}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{stats.total}</p>
              </div>
            </div>

            {/* Recent Tasks */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <LayoutList className="w-4 h-4" />
                Task History
              </h3>
              <ScrollArea className="h-[400px] pr-4">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading tasks...
                  </div>
                ) : taskList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-secondary/50 rounded-lg">
                    No tasks assigned yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {taskList.map((task) => (
                      <div key={task.id} className="p-3 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-sm line-clamp-1">{task.title}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${task.status === 'completed' ? 'bg-green-100 text-green-700' :
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          {task.project_name && <span className="bg-secondary px-1.5 py-0.5 rounded">{task.project_name}</span>}
                          {task.workspace_name && <span className="opacity-70">in {task.workspace_name}</span>}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(task.created_at).toLocaleDateString()}
                          </span>
                          <span className="capitalize">{task.priority} Priority</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

function TeamContent() {
  const { user } = useAuth();
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

  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem('active_workspace_id', activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  const membersKey = activeWorkspaceId
    ? `/api/workspace-members?workspaceId=${activeWorkspaceId}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<WorkspaceMember[]>(membersKey, authFetcher);
  const members = useMemo(() => data || [], [data]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState<CreatedEmployee | null>(null);
  const [createForm, setCreateForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    designation: '',
  });

  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null);

  const handleCreateEmployee = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError('');
    setCreatedEmployee(null);

    if (!createForm.email || !createForm.first_name || !createForm.last_name) {
      setCreateError('Missing required fields');
      return;
    }

    setIsCreatingEmployee(true);
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: createForm.email.trim(),
          first_name: createForm.first_name.trim(),
          last_name: createForm.last_name.trim(),
          designation: createForm.designation.trim(),
          workspace_id: activeWorkspaceId ? Number(activeWorkspaceId) : 1,
          workspace_role: 'member',
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create employee');

      // Employee created successfully - close dialog and refresh
      await mutate();
      setIsCreateOpen(false);
      setCreateForm({
        email: '',
        first_name: '',
        last_name: '',
        designation: '',
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create employee');
    } finally {
      setIsCreatingEmployee(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />

      <main className="w-full md:pl-64 p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Team</h1>
            <p className="text-muted-foreground">Workspace members and performance</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
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
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {user?.role === 'admin' && (
              <Dialog
                open={isCreateOpen}
                onOpenChange={(open) => {
                  setIsCreateOpen(open);
                  if (!open) {
                    setCreateError('');
                    setCreatedEmployee(null);
                    setCreateForm({
                      email: '',
                      first_name: '',
                      last_name: '',
                      designation: '',
                    });
                  }
                }}
              >
                <DialogTrigger asChild>
                  {/* CHANGED: Retained 'Create employee' functionality but renamed to 'Add member' and styled blue */}
                  <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <UserPlus className="w-4 h-4" />
                    Add member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Team Member</DialogTitle>
                    <DialogDescription>
                      Create credentials for a new employee and add them to the workspace.
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateEmployee} className="space-y-4">
                    {createError && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                        {createError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="ce_first">First name</Label>
                        <Input
                          id="ce_first"
                          value={createForm.first_name}
                          onChange={(e) => setCreateForm((s) => ({ ...s, first_name: e.target.value }))}
                          disabled={isCreatingEmployee}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ce_last">Last name</Label>
                        <Input
                          id="ce_last"
                          value={createForm.last_name}
                          onChange={(e) => setCreateForm((s) => ({ ...s, last_name: e.target.value }))}
                          disabled={isCreatingEmployee}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ce_email">Email</Label>
                      <Input
                        id="ce_email"
                        type="email"
                        value={createForm.email}
                        onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))}
                        disabled={isCreatingEmployee}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ce_designation">Designation</Label>
                      <Input
                        id="ce_designation"
                        value={createForm.designation}
                        onChange={(e) => setCreateForm((s) => ({ ...s, designation: e.target.value }))}
                        disabled={isCreatingEmployee}
                        placeholder="e.g. Frontend Developer"
                        required
                      />
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => setIsCreateOpen(false)}
                        disabled={isCreatingEmployee}
                      >
                        Close
                      </Button>
                      <Button type="submit" disabled={isCreatingEmployee} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                        {isCreatingEmployee ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Add Member'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}

            {/* REMOVED: Invite member dialog as requested */}
          </div>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6">
                <div className="h-5 w-1/2 rounded bg-secondary skeleton" />
                <div className="h-4 w-2/3 rounded bg-secondary skeleton mt-3" />
                <div className="h-4 w-3/4 rounded bg-secondary skeleton mt-2" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-10 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </Card>
        ) : members.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-60" />
            <p className="text-muted-foreground">No members found in this workspace.</p>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {members.map((m, idx) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -4 }}
                onClick={() => setSelectedMember(m)}
                className="cursor-pointer"
              >
                <Card className="p-6 hover:shadow-lg transition-smooth border-transparent hover:border-primary/20 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-primary/10 text-primary text-[10px] uppercase font-bold px-2 py-1 rounded">
                      View Details
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-primary/20">
                      {m.first_name?.charAt(0)}
                      {m.last_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {m.first_name} {m.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold px-2 py-1 rounded-md bg-secondary text-foreground capitalize">
                      {m.designation || 'Member'}
                    </span>

                    {/* Activity Indicator (Example) */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-xs text-muted-foreground">Active</span>
                    </div>
                  </div>

                  {/* Minified Stats */}
                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      <span className="font-bold text-foreground">{m.completed_tasks || 0}</span> Completed
                    </span>
                    <span>
                      <span className="font-bold text-foreground">{m.total_tasks || 0}</span> Total
                    </span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        <EmployeeDetailsSheet
          member={selectedMember}
          workspaceId={activeWorkspaceId}
          isOpen={!!selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      </main>
    </div>
  );
}

export default function TeamPage() {
  return (
    <ProtectedRoute>
      <TeamContent />
    </ProtectedRoute>
  );
}
