'use client';

import { useMemo, useState, FormEvent } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Building2, Loader2, AlertCircle, Users as UsersIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Workspace = {
  id: number;
  name: string;
  description?: string;
  color_scheme?: string;
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

type WorkspaceMember = {
  user_id: number;
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
};

function WorkspacesContent() {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useSWR<Workspace[]>('/api/workspaces', authFetcher);
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const workspaces = useMemo(() => data || [], [data]);

  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [formError, setFormError] = useState('');

  const [membersDialogWorkspace, setMembersDialogWorkspace] = useState<Workspace | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<{ id: number; first_name: string; last_name: string; email: string }[]>([]);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberError, setMemberError] = useState('');

  const membersKey = membersDialogWorkspace ? `/api/workspace-members?workspaceId=${membersDialogWorkspace.id}` : null;
  const { data: membersData, mutate: mutateMembers } = useSWR<WorkspaceMember[]>(membersKey, authFetcher);
  const workspaceMembers = useMemo(() => membersData || [], [membersData]);

  const handleSearchMembers = async () => {
    if (!membersDialogWorkspace || memberSearch.trim().length < 2) return;
    setMemberError('');
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch(`/api/users/search?workspaceId=${membersDialogWorkspace.id}&q=${encodeURIComponent(memberSearch.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setMemberSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'Search failed');
      setMemberSearchResults([]);
    }
  };

  const handleAddWorkspaceMember = async (userId: number) => {
    if (!membersDialogWorkspace) return;
    setIsAddingMember(true);
    setMemberError('');
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/workspace-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspace_id: membersDialogWorkspace.id, user_id: userId, role: 'member' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add member');
      setMemberSearch('');
      setMemberSearchResults([]);
      await mutateMembers();
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');
    setIsCreating(true);

    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create workspace');

      setFormData({ name: '', description: '' });
      setShowForm(false);
      await mutate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />

      <main className="w-full md:pl-64 p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Workspaces</h1>
            <p className="text-muted-foreground">Organize projects and teams by workspace</p>
          </div>

          {canManage && (
            <Button onClick={() => setShowForm((s) => !s)} className="gap-2 btn-hover-lift">
              <Plus className="w-4 h-4" />
              New Workspace
            </Button>
          )}
        </motion.div>

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

                  <div>
                    <Label htmlFor="name">Workspace Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={isCreating}
                      placeholder="e.g. Product Team"
                    />
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
                      placeholder="What is this workspace for?"
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
                        'Create Workspace'
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-6">
                <div className="h-5 w-1/2 rounded bg-secondary skeleton" />
                <div className="h-4 w-3/4 rounded bg-secondary skeleton mt-3" />
                <div className="h-4 w-2/3 rounded bg-secondary skeleton mt-2" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-10 text-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </Card>
        ) : workspaces.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-60" />
            <p className="text-muted-foreground">No workspaces yet. Create one to get started.</p>
          </Card>
        ) : (
          <>
          <Dialog open={!!membersDialogWorkspace} onOpenChange={(open) => !open && setMembersDialogWorkspace(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Workspace Members</DialogTitle>
                <DialogDescription>
                  Add members to {membersDialogWorkspace?.name}. Only workspace members can be added to projects and assigned tasks.
                </DialogDescription>
              </DialogHeader>
              {membersDialogWorkspace && (
                <div className="space-y-4">
                  <div>
                    <Label>Add member (search by name or email)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        placeholder="Search users..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchMembers())}
                      />
                      <Button onClick={handleSearchMembers} disabled={memberSearch.trim().length < 2}>
                        Search
                      </Button>
                    </div>
                    {memberError && <p className="text-sm text-destructive mt-1">{memberError}</p>}
                    {memberSearchResults.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto border rounded-md divide-y">
                        {memberSearchResults
                          .filter((u) => !workspaceMembers.some((m) => (m.user_id ?? m.id) === u.id))
                          .map((u) => (
                            <div key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
                              <span>{u.first_name} {u.last_name} ({u.email})</span>
                              <Button
                                size="sm"
                                disabled={isAddingMember}
                                onClick={() => handleAddWorkspaceMember(u.id)}
                              >
                                Add
                              </Button>
                            </div>
                          ))}
                        {memberSearchResults.filter((u) => !workspaceMembers.some((m) => (m.user_id ?? m.id) === u.id)).length === 0 && (
                          <p className="px-3 py-2 text-sm text-muted-foreground">All results already in workspace</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Current members</Label>
                    <div className="mt-1 max-h-48 overflow-y-auto border rounded-md divide-y">
                      {workspaceMembers.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-muted-foreground">No members yet</p>
                      ) : (
                        workspaceMembers.map((m) => (
                          <div key={(m.user_id ?? m.id) ?? m.email} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span>{m.first_name} {m.last_name} ({m.email})</span>
                            <span className="text-xs text-muted-foreground capitalize">{m.role || 'member'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setMembersDialogWorkspace(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {workspaces.map((w, idx) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -4 }}
              >
                <Card className="p-6 hover:shadow-lg transition-smooth">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-foreground truncate">{w.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {w.description || 'No description'}
                      </p>
                    </div>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: (w.color_scheme as string) || '#3B82F6' }}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(w.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-transparent gap-1"
                          onClick={() => {
                            setMembersDialogWorkspace(w);
                            setMemberSearch('');
                            setMemberSearchResults([]);
                            setMemberError('');
                          }}
                        >
                          <UsersIcon className="w-4 h-4" />
                          Add Members
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="bg-transparent"
                        onClick={() => {
                          localStorage.setItem('active_workspace_id', String(w.id));
                          window.location.href = '/projects';
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
          </>
        )}
      </main>
    </div>
  );
}

export default function WorkspacesPage() {
  return (
    <ProtectedRoute>
      <WorkspacesContent />
    </ProtectedRoute>
  );
}
