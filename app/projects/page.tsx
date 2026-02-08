'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Folder,
  Loader2,
  AlertCircle,
  ChevronDown,
  Palette,
  Users as UsersIcon,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Workspace = {
  id: number;
  name: string;
};

type Project = {
  id: number;
  workspace_id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: 'active' | 'archived' | 'completed';
  created_at: string;
  first_name?: string;
  last_name?: string;
};

type WorkspaceMember = {
  id: number;
  workspace_id: number;
  user_id: number;
  workspace_role: 'admin' | 'manager' | 'member' | 'viewer';
  joined_at: string;
  is_active: boolean;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  app_role: 'admin' | 'manager' | 'employee';
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

function ProjectsContent() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const { data: workspaces, error: wsError, isLoading: wsLoading } = useSWR<Workspace[]>(
    '/api/workspaces',
    authFetcher
  );

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

  const projectsKey = activeWorkspaceId ? `/api/projects?workspaceId=${activeWorkspaceId}` : null;
  const {
    data: projects,
    error: projectsError,
    isLoading: projectsLoading,
    mutate,
  } = useSWR<Project[]>(projectsKey, authFetcher);

  const projectList = useMemo(() => projects || [], [projects]);

  const membersKey = canManage && activeWorkspaceId ? `/api/workspace-members?workspaceId=${activeWorkspaceId}` : null;
  const { data: workspaceMembers } = useSWR<WorkspaceMember[]>(membersKey, authFetcher);
  const workspaceMemberList = useMemo(() => workspaceMembers || [], [workspaceMembers]);

  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedMemberUserId, setSelectedMemberUserId] = useState<string>('unselected');
  const [isUpdatingMembers, setIsUpdatingMembers] = useState(false);

  const projectMembersKey =
    isMembersOpen && selectedProject?.id ? `/api/project-members?projectId=${selectedProject.id}` : null;
  const { data: projectMembers, mutate: mutateProjectMembers } = useSWR<ProjectMember[]>(
    projectMembersKey,
    authFetcher
  );
  const projectMemberList = useMemo(() => projectMembers || [], [projectMembers]);

  const [isMarkingCompleted, setIsMarkingCompleted] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'folder',
  });

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');
    if (!activeWorkspaceId) {
      setFormError('Please select a workspace first');
      return;
    }
    setIsCreating(true);

    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspace_id: Number(activeWorkspaceId),
          name: formData.name,
          description: formData.description,
          color: formData.color,
          icon: formData.icon,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create project');

      setFormData({ name: '', description: '', color: '#3B82F6', icon: 'folder' });
      setShowForm(false);
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const openMembers = (project: Project) => {
    setSelectedProject(project);
    setSelectedMemberUserId('unselected');
    setIsMembersOpen(true);
  };

  const addProjectMember = async () => {
    if (!selectedProject?.id) return;
    if (selectedMemberUserId === 'unselected') return;
    const token = sessionStorage.getItem('auth_token');
    setIsUpdatingMembers(true);
    try {
      const res = await fetch('/api/project-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_id: selectedProject.id,
          user_id: Number(selectedMemberUserId),
          role: 'member',
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to add member');
      setSelectedMemberUserId('unselected');
      await mutateProjectMembers();
    } finally {
      setIsUpdatingMembers(false);
    }
  };

  const removeProjectMember = async (projectMemberId: number) => {
    const token = sessionStorage.getItem('auth_token');
    setIsUpdatingMembers(true);
    try {
      const res = await fetch('/api/project-members', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: projectMemberId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to remove member');
      await mutateProjectMembers();
    } finally {
      setIsUpdatingMembers(false);
    }
  };

  const markProjectCompleted = async (projectId: number) => {
    const token = sessionStorage.getItem('auth_token');
    setIsMarkingCompleted(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to update project');
      await mutate();
    } finally {
      setIsMarkingCompleted(null);
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
            <h1 className="text-4xl font-bold text-foreground mb-2">Projects</h1>
            <p className="text-muted-foreground">Your projects inside the selected workspace</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative">
              <select
                value={activeWorkspaceId}
                onChange={(e) => setActiveWorkspaceId(e.target.value)}
                className="h-10 pl-3 pr-10 rounded-lg border border-input bg-background text-foreground"
                disabled={wsLoading || workspaceList.length === 0}
              >
                {workspaceList.map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {w.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {canManage && (
              <Button
                onClick={() => setShowForm((s) => !s)}
                className="gap-2 btn-hover-lift"
                disabled={!activeWorkspaceId || workspaceList.length === 0}
              >
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            )}
          </div>
        </motion.div>

        {(wsError as any) && (
          <Card className="p-10 text-center mb-6">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
            <p className="text-muted-foreground">{(wsError as Error).message}</p>
          </Card>
        )}

        <AnimatePresence>
          {canManage && showForm && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="mb-8"
            >
              <Card className="p-6">
                <form onSubmit={handleCreate} className="space-y-4">
                  {formError && (
                    <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                      <p className="text-sm text-destructive">{formError}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Project Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        disabled={isCreating}
                        placeholder="e.g. Mobile App"
                      />
                    </div>

                    <div>
                      <Label htmlFor="color">Accent Color</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="color"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          disabled={isCreating}
                        />
                        <div
                          className="w-10 h-10 rounded-xl border border-border"
                          style={{ backgroundColor: formData.color }}
                          title="Preview"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      disabled={isCreating}
                      rows={3}
                      className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground transition-smooth"
                      placeholder="Short description of the project"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-transparent"
                      onClick={() => setShowForm(false)}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreating} className="gap-2">
                      {isCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Project'
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Dialog
          open={isMembersOpen}
          onOpenChange={(open) => {
            setIsMembersOpen(open);
            if (!open) setSelectedProject(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Project Members</DialogTitle>
              <DialogDescription>
                {canManage ? 'Add workspace members to this project. Only project members can be assigned tasks.' : 'Project members who can be assigned tasks.'}
              </DialogDescription>
            </DialogHeader>

            {!selectedProject ? (
              <Card className="p-4 text-sm text-muted-foreground">Select a project.</Card>
            ) : (
              <div className="space-y-4">
                {canManage && (
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Add member</Label>
                    <Select value={selectedMemberUserId} onValueChange={setSelectedMemberUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select workspace member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unselected">Select…</SelectItem>
                        {workspaceMemberList.map((m) => {
                          const uid = (m as { user_id?: number }).user_id ?? (m as { id?: number }).id;
                          if (!uid) return null;
                          return (
                            <SelectItem key={uid} value={String(uid)}>
                              {m.first_name} {m.last_name} ({m.email})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="gap-2"
                    onClick={() => addProjectMember().catch(console.error)}
                    disabled={isUpdatingMembers || selectedMemberUserId === 'unselected'}
                  >
                    {isUpdatingMembers ? <Loader2 className="w-4 h-4 animate-spin" /> : <UsersIcon className="w-4 h-4" />}
                    Add
                  </Button>
                </div>
                )}

                {projectMemberList.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">No project members yet.</Card>
                ) : (
                  <div className="space-y-2">
                    {projectMemberList.map((pm) => (
                      <Card key={pm.id} className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {pm.first_name} {pm.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{pm.email}</p>
                        </div>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeProjectMember(pm.id).catch(console.error)}
                            disabled={isUpdatingMembers}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" className="bg-transparent" onClick={() => setIsMembersOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {projectsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6">
                <div className="h-5 w-1/2 rounded bg-secondary skeleton" />
                <div className="h-4 w-3/4 rounded bg-secondary skeleton mt-3" />
                <div className="h-4 w-2/3 rounded bg-secondary skeleton mt-2" />
              </Card>
            ))}
          </div>
        ) : projectsError ? (
          <Card className="p-10 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
            <p className="text-muted-foreground">{(projectsError as Error).message}</p>
          </Card>
        ) : !activeWorkspaceId ? (
          <Card className="p-12 text-center">
            <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-60" />
            <p className="text-muted-foreground">Select a workspace above to view and create projects.</p>
          </Card>
        ) : projectList.length === 0 ? (
          <Card className="p-12 text-center">
            <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-60" />
            <p className="text-muted-foreground">No projects yet. Create one to get started.</p>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {projectList.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -4 }}
              >
                <Card className="p-6 hover:shadow-lg transition-smooth">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-foreground truncate">{p.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {p.description || 'No description'}
                      </p>
                    </div>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: p.color || '#3B82F6' }}
                    >
                      <Palette className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground truncate">
                      Owner {p.first_name ? `${p.first_name} ${p.last_name}` : '—'}
                    </p>
                    {p.status === 'completed' && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-md bg-accent/10 text-accent flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="bg-transparent"
                      onClick={() => {
                        localStorage.setItem('active_project_id', String(p.id));
                        window.location.href = '/tasks';
                      }}
                    >
                      View Tasks
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-transparent gap-2"
                      onClick={() => openMembers(p)}
                    >
                      <UsersIcon className="w-4 h-4" />
                      {canManage ? 'Add Members' : 'Members'}
                    </Button>
                    {canManage && (
                    <Button
                      className="gap-2"
                      onClick={() => markProjectCompleted(p.id).catch(console.error)}
                      disabled={p.status === 'completed' || isMarkingCompleted === p.id}
                    >
                      {isMarkingCompleted === p.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Complete
                    </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <ProjectsContent />
    </ProtectedRoute>
  );
}
