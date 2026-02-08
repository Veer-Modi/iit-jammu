'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import useSWR from 'swr';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Loader2,
  Filter,
  X,
  LayoutList,
  Columns3,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JSX } from 'react/jsx-runtime'; // Import JSX

const TaskStatuses = ['todo', 'in_progress', 'in_review', 'completed', 'cancelled'];
const TaskPriorities = ['low', 'medium', 'high', 'urgent'];

const statusIcons: Record<string, JSX.Element> = {
  todo: <Circle className="w-4 h-4 text-gray-400" />,
  in_progress: <Clock className="w-4 h-4 text-blue-500" />,
  in_review: <AlertCircle className="w-4 h-4 text-purple-500" />,
  completed: <CheckCircle2 className="w-4 h-4 text-accent" />,
  cancelled: <X className="w-4 h-4 text-destructive" />,
};

const priorityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  urgent: 'bg-destructive/10 text-destructive',
};

interface Task {
  id: number;
  project_id?: number;
  workspace_id?: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  assigned_to?: number;
  created_at: string;
  first_name?: string;
  last_name?: string;
}

type TaskComment = {
  id: number;
  task_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
};

type Workspace = {
  id: number;
  name: string;
};

type Project = {
  id: number;
  name: string;
  workspace_id: number;
};

type ProjectMember = {
  id: number;
  project_id: number;
  user_id: number;
  project_role: 'owner' | 'member' | 'viewer';
  added_at: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  workspace_role?: string;
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

function TasksContent() {
  const { data: workspaces } = useSWR<Workspace[]>('/api/workspaces', authFetcher);
  const workspaceList = useMemo(() => workspaces || [], [workspaces]);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [activeProjectId, setActiveProjectId] = useState<string>('');

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

  useEffect(() => {
    const storedProject = localStorage.getItem('active_project_id');
    if (storedProject) setActiveProjectId(storedProject);
  }, []);

  useEffect(() => {
    if (activeProjectId) localStorage.setItem('active_project_id', activeProjectId);
  }, [activeProjectId]);

  const projectsKey = activeWorkspaceId
    ? `/api/projects?workspaceId=${activeWorkspaceId}`
    : null;
  const { data: projects } = useSWR<Project[]>(projectsKey, authFetcher);
  const projectList = useMemo(() => projects || [], [projects]);

  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assigned_to: null as number | null,
  });

  const tasksKey = activeWorkspaceId
    ? `/api/tasks?workspaceId=${activeWorkspaceId}${activeProjectId ? `&projectId=${activeProjectId}` : ''
    }`
    : null;

  const {
    data: tasks,
    error: tasksError,
    isLoading: tasksLoading,
    mutate,
  } = useSWR<Task[]>(tasksKey, authFetcher);

  const taskList = useMemo(() => tasks || [], [tasks]);
  const assigneeForTask = (task: Task) => {
    if (!task.first_name && !task.last_name) return null;
    const initials = `${task.first_name?.[0] || ''}${task.last_name?.[0] || ''}` || 'U';
    const fullName = `${task.first_name || ''} ${task.last_name || ''}`.trim();
    return { initials, fullName };
  };

  const membersKey = activeProjectId ? `/api/project-members?projectId=${activeProjectId}` : null;
  const { data: projectMembers } = useSWR<ProjectMember[]>(membersKey, authFetcher);
  const memberList = useMemo(() => projectMembers || [], [projectMembers]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [isUpdatingAssignee, setIsUpdatingAssignee] = useState(false);

  const handleAssigneeChange = async (taskId: number, assigneeUserId: number | null) => {
    const token = sessionStorage.getItem('auth_token');
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ assigned_to: assigneeUserId }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Failed to update assignee');
  };

  const handleCreateTask = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!activeWorkspaceId) throw new Error('Select a workspace first');
      if (!activeProjectId) throw new Error('Select a project first');

      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspace_id: Number(activeWorkspaceId),
          project_id: Number(activeProjectId),
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          due_date: formData.due_date || null,
          assigned_to: formData.assigned_to || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create task');

      setFormData({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: null });
      setShowForm(false);
      await mutate();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTask = async (id: number) => {
    const token = sessionStorage.getItem('auth_token');
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Failed to delete task');
    await mutate();
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    const token = sessionStorage.getItem('auth_token');
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Failed to update task');
    await mutate();
  };

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setIsTaskOpen(true);
  };

  const commentsKey = selectedTask?.id
    ? `/api/task-comments?taskId=${selectedTask.id}`
    : null;
  const {
    data: comments,
    error: commentsError,
    isLoading: commentsLoading,
    mutate: mutateComments,
  } = useSWR<TaskComment[]>(commentsKey, authFetcher);

  const commentList = useMemo(() => comments || [], [comments]);
  const [commentInput, setCommentInput] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  const handleAddComment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTask?.id) return;
    if (!commentInput.trim()) return;

    setIsPostingComment(true);
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/task-comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ task_id: selectedTask.id, content: commentInput }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to add comment');
      setCommentInput('');
      await mutateComments();
    } finally {
      setIsPostingComment(false);
    }
  };

  const filteredTasks = taskList.filter((task) => {
    const statusMatch = filterStatus === 'all' || task.status === filterStatus;
    const priorityMatch =
      filterPriority === 'all' || task.priority === filterPriority;
    return statusMatch && priorityMatch;
  });

  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of TaskStatuses) map[s] = [];
    for (const t of filteredTasks) {
      if (!map[t.status]) map[t.status] = [];
      map[t.status].push(t);
    }
    return map;
  }, [filteredTasks]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />

      <main className="w-full md:pl-64 p-4 md:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Tasks
            </h1>
            <p className="text-muted-foreground">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Select value={activeWorkspaceId} onValueChange={setActiveWorkspaceId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaceList.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={activeProjectId} onValueChange={setActiveProjectId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projectList.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => setShowForm(!showForm)}
              className="gap-2 btn-hover-lift"
              disabled={!activeWorkspaceId || !activeProjectId}
            >
              <Plus className="w-4 h-4" />
              New Task
            </Button>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList>
                <TabsTrigger value="list" className="gap-2">
                  <LayoutList className="w-4 h-4" />
                  List
                </TabsTrigger>
                <TabsTrigger value="kanban" className="gap-2">
                  <Columns3 className="w-4 h-4" />
                  Kanban
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </motion.div>

        {/* Project Tracker */}
        {activeProjectId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-primary">
              <div className="p-2 bg-primary/10 rounded-full">
                <LayoutList className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Tasks</p>
                <p className="text-2xl font-bold text-foreground">{taskList.length}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-accent">
              <div className="p-2 bg-accent/10 rounded-full">
                <CheckCircle2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Completed</p>
                <p className="text-2xl font-bold text-foreground">
                  {taskList.filter((t) => t.status === 'completed').length}
                </p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-blue-500">
              <div className="p-2 bg-blue-500/10 rounded-full">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">In Progress</p>
                <p className="text-2xl font-bold text-foreground">
                  {taskList.filter((t) => t.status === 'in_progress').length}
                </p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-yellow-500">
              <div className="p-2 bg-yellow-500/10 rounded-full">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pending</p>
                <p className="text-2xl font-bold text-foreground">
                  {taskList.filter((t) => t.status === 'todo').length}
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Create Task Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <Card className="p-6">
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Task Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter task title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      placeholder="Enter task description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      disabled={isLoading}
                      rows={3}
                      className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground transition-smooth"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) =>
                          setFormData({ ...formData, priority: value })
                        }
                      >
                        <SelectTrigger id="priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TaskPriorities.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p.charAt(0).toUpperCase() + p.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="due_date">Due Date</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) =>
                          setFormData({ ...formData, due_date: e.target.value })
                        }
                        disabled={isLoading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="assignee">Assign to</Label>
                      <Select
                        value={formData.assigned_to ? String(formData.assigned_to) : 'unassigned'}
                        onValueChange={(v) =>
                          setFormData({ ...formData, assigned_to: v === 'unassigned' ? null : Number(v) })
                        }
                      >
                        <SelectTrigger id="assignee">
                          <SelectValue placeholder="Select member" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {memberList.map((m) => (
                            <SelectItem key={m.id} value={String(m.user_id)}>
                              {m.first_name} {m.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Task'
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-4 mb-8"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Filter:
            </span>
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {TaskStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() +
                    status.slice(1).replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {TaskPriorities.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Tasks */}
        {viewMode === 'list' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <AnimatePresence>
              {!activeWorkspaceId || !activeProjectId ? (
                <Card className="p-12 text-center">
                  <ListTodo className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    {!activeWorkspaceId ? 'Select a workspace and project to view and create tasks.' : 'Select a project to view and create tasks.'}
                  </p>
                </Card>
              ) : tasksLoading ? (
                <Card className="p-12 text-center">
                  <Loader2 className="w-10 h-10 text-muted-foreground mx-auto mb-4 animate-spin" />
                  <p className="text-muted-foreground">Loading tasks...</p>
                </Card>
              ) : tasksError ? (
                <Card className="p-12 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">{(tasksError as Error).message}</p>
                </Card>
              ) : filteredTasks.length === 0 ? (
                <Card className="p-12 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    No tasks found. Create one to get started!
                  </p>
                </Card>
              ) : (
                filteredTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ x: 5 }}
                  >
                    <Card
                      className="p-4 hover:shadow-lg transition-smooth cursor-pointer group"
                      onClick={() => openTask(task)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 flex items-start gap-4">
                          {/* Status Icon */}
                          <div className="mt-1">
                            {statusIcons[task.status]}
                          </div>

                          {/* Task Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {task.description}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-2 mt-3">
                              {/* Priority Badge */}
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${priorityColors[task.priority]
                                  }`}
                              >
                                {task.priority.charAt(0).toUpperCase() +
                                  task.priority.slice(1)}
                              </span>

                              {/* Due Date */}
                              {task.due_date && (
                                <span className="inline-flex items-center px-2 py-1 text-xs text-muted-foreground bg-secondary rounded-md">
                                  {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}

                              {assigneeForTask(task) && (
                                <span className="inline-flex items-center gap-2 ml-auto">
                                  <span className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[11px] font-semibold">
                                    {assigneeForTask(task)?.initials}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Select
                            value={task.status}
                            onValueChange={(newStatus) =>
                              handleStatusChange(task.id, newStatus)
                            }
                          >
                            <SelectTrigger className="w-40 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TaskStatuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status
                                    .charAt(0)
                                    .toUpperCase() +
                                    status.slice(1).replace('_', ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await handleDeleteTask(task.id);
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </motion.div>
        ) : !activeWorkspaceId || !activeProjectId ? (
          <Card className="p-12 text-center">
            <ListTodo className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              {!activeWorkspaceId ? 'Select a workspace and project to use the Kanban board.' : 'Select a project to use the Kanban board.'}
            </p>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-4"
          >
            {TaskStatuses.map((status) => (
              <Card
                key={status}
                className="p-3 min-h-[320px]"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  const taskId = e.dataTransfer.getData('text/task-id');
                  if (!taskId) return;
                  handleStatusChange(Number(taskId), status).catch(console.error);
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {status.replace('_', ' ')}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {tasksByStatus[status]?.length || 0}
                  </span>
                </div>

                <div className="space-y-2">
                  {(tasksByStatus[status] || []).map((task) => (
                    <Card
                      key={task.id}
                      className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-smooth"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/task-id', String(task.id));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => openTask(task)}
                    >
                      <p className="text-sm font-semibold text-foreground line-clamp-2">
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {task.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium ${priorityColors[task.priority]
                            }`}
                        >
                          {task.priority}
                        </span>

                        {assigneeForTask(task) && (
                          <span className="inline-flex items-center gap-2 ml-auto">
                            <span className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[11px] font-semibold">
                              {assigneeForTask(task)?.initials}
                            </span>
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Task details */}
        <Sheet open={isTaskOpen} onOpenChange={setIsTaskOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between gap-3">
                <span className="truncate">{selectedTask?.title || 'Task'}</span>
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageSquare className="w-4 h-4" />
                  {commentList.length}
                </span>
              </SheetTitle>
              <SheetDescription>
                Manage details, status, and comments.
              </SheetDescription>
            </SheetHeader>

            {!selectedTask ? (
              <div className="pt-6 text-muted-foreground">Select a task to view details.</div>
            ) : (
              <div className="pt-6 space-y-6">
                <Card className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Status</Label>
                      <Select
                        value={selectedTask.status}
                        onValueChange={(newStatus) => {
                          handleStatusChange(selectedTask.id, newStatus)
                            .then(() => {
                              setSelectedTask((t) => (t ? { ...t, status: newStatus } : t));
                            })
                            .catch(console.error);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TaskStatuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Priority</Label>
                      <Select
                        value={selectedTask.priority}
                        onValueChange={(newPriority) => {
                          const token = sessionStorage.getItem('auth_token');
                          fetch(`/api/tasks/${selectedTask.id}`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ priority: newPriority }),
                          })
                            .then(async (res) => {
                              const payload = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(payload.error || 'Failed to update');
                              setSelectedTask((t) => (t ? { ...t, priority: newPriority } : t));
                              await mutate();
                            })
                            .catch(console.error);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TaskPriorities.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label>Assignee</Label>
                    <Select
                      value={
                        selectedTask.assigned_to !== undefined && selectedTask.assigned_to !== null
                          ? String(selectedTask.assigned_to)
                          : 'unassigned'
                      }
                      onValueChange={(value) => {
                        const nextAssignee =
                          value === 'unassigned' ? null : Number.parseInt(value, 10);

                        setIsUpdatingAssignee(true);
                        handleAssigneeChange(selectedTask.id, nextAssignee)
                          .then(async () => {
                            setSelectedTask((t) =>
                              t ? { ...t, assigned_to: nextAssignee ?? undefined } : t
                            );
                            await mutate();
                          })
                          .catch(console.error)
                          .finally(() => setIsUpdatingAssignee(false));
                      }}
                      disabled={isUpdatingAssignee}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {memberList.map((m) => (
                          <SelectItem key={m.user_id} value={String(m.user_id)}>
                            {m.first_name} {m.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTask.description && (
                    <div className="mt-4">
                      <Label>Description</Label>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                        {selectedTask.description}
                      </p>
                    </div>
                  )}
                </Card>

                <div>
                  <div className="space-y-2">
                    <Label htmlFor="comment">Daily Commit / Comments</Label>
                    <div className="flex gap-2">
                      <Input
                        id="comment"
                        placeholder="Type your update..."
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(e as any);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          if (!commentInput.includes('Daily Commit:')) {
                            setCommentInput((prev) =>
                              prev ? `Daily Commit: ${prev}` : 'Daily Commit: '
                            );
                          }
                        }}
                        variant="outline"
                        title="Mark as Daily Commit"
                      >
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      </Button>
                      <Button onClick={(e) => handleAddComment(e as any)} disabled={isPostingComment}>
                        {isPostingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4 mt-6">
                    <h4 className="text-sm font-medium text-muted-foreground">Activity & Commits</h4>

                    {commentsLoading ? (
                      <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                    ) : commentList.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground bg-secondary/20 rounded-lg border border-dashed">
                        No commits yet.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                        {commentList.map((comment) => (
                          <div key={comment.id} className="flex gap-3 text-sm">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-primary">
                                {comment.first_name?.[0]}{comment.last_name?.[0]}
                              </span>
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold">{comment.first_name} {comment.last_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(comment.created_at).toLocaleString()}
                                </span>
                              </div>
                              <div className={`p-3 rounded-lg ${comment.content.includes('Daily Commit')
                                  ? 'bg-primary/5 border border-primary/20'
                                  : 'bg-secondary'
                                }`}>
                                <p className="text-foreground whitespace-pre-wrap">{comment.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </main>
    </div>
  );
}

export default function TasksPage() {
  return (
    <ProtectedRoute>
      <TasksContent />
    </ProtectedRoute>
  );
}
