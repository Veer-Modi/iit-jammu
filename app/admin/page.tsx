'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, CheckCircle2, XCircle, Users, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadRequests = async () => {
    if (!adminKey) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/trial-requests', {
        headers: { 'x-admin-key': adminKey },
      });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
      setAuthenticated(true);
    } catch {
      setError('Invalid admin key');
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch('/api/trial-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ id, action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (id: number) => {
    try {
      const res = await fetch('/api/trial-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ id, action: 'reject' }),
      });
      if (!res.ok) throw new Error('Failed');
      await loadRequests();
    } catch {
      setError('Failed to reject');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage 7-day trial requests</p>
          </div>
        </div>

        {!authenticated ? (
          <Card className="p-6">
            <Label>Admin Key</Label>
            <div className="flex gap-2 mt-2">
              <Input
                type="password"
                placeholder="Enter admin secret from .env ADMIN_SECRET"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadRequests()}
              />
              <Button onClick={loadRequests} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Access'}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </Card>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex justify-between items-center mb-4">
              <p className="text-muted-foreground">
                <Clock className="w-4 h-4 inline mr-1" />
                {requests.filter((r) => r.status === 'pending').length} pending
              </p>
              <Button variant="outline" size="sm" onClick={loadRequests} disabled={loading}>
                Refresh
              </Button>
            </div>
            <div className="space-y-4">
              {requests.length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  No trial requests yet
                </Card>
              ) : (
                requests.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-foreground">
                          {r.first_name} {r.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{r.email}</p>
                        {r.company_name && (
                          <p className="text-xs text-muted-foreground mt-1">Company: {r.company_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(r.created_at).toLocaleString()} •{' '}
                          <span
                            className={
                              r.status === 'pending'
                                ? 'text-yellow-600'
                                : r.status === 'approved'
                                  ? 'text-green-600'
                                  : 'text-red-600'
                            }
                          >
                            {r.status}
                          </span>
                        </p>
                      </div>
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApprove(r.id)} className="gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Approve Trial
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(r.id)} className="gap-1">
                            <XCircle className="w-4 h-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
