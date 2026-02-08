'use client';

import { useState, useEffect, FormEvent } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Save, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

type UserProfile = {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    bio?: string;
    avatar_url?: string;
    role: string;
    trial_ends_at?: string;
    is_trial_approved?: boolean;
};

function ProfileContent() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        phone: '',
        bio: '',
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = sessionStorage.getItem('auth_token');
            const res = await fetch('/api/users/profile', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                setFormData({
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                    phone: data.phone || '',
                    bio: data.bio || '',
                });
            }
        } catch (error) {
            console.error('Fetch profile error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        try {
            const token = sessionStorage.getItem('auth_token');
            const res = await fetch('/api/users/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage('Profile updated successfully!');
                setProfile(data.user);
                setTimeout(() => setMessage(''), 3000);
            } else {
                setMessage(data.error || 'Failed to update profile');
            }
        } catch (error) {
            setMessage('An error occurred');
        } finally {
            setSaving(false);
        }
    };

    const daysRemaining = profile?.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(profile.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    return (
        <div className="min-h-screen bg-background">
            <DashboardSidebar />

            <main className="w-full md:pl-64 p-8">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto"
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
                            <p className="text-muted-foreground">Manage your account information</p>
                        </div>
                    </div>

                    {loading ? (
                        <Card className="p-12 text-center">
                            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground">Loading profile...</p>
                        </Card>
                    ) : (
                        <>
                            {/* Trial Status */}
                            {profile?.is_trial_approved && daysRemaining !== null && (
                                <Card className="p-6 mb-6 border-l-4 border-l-primary">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <Calendar className="w-6 h-6 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-lg text-foreground">7-Day Trial Status</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {daysRemaining > 0
                                                    ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining in your trial`
                                                    : 'Your trial has expired'}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {/* Profile Form */}
                            <Card className="p-6">
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <Label htmlFor="first_name">First Name</Label>
                                            <Input
                                                id="first_name"
                                                value={formData.first_name}
                                                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                                required
                                                disabled={saving}
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="last_name">Last Name</Label>
                                            <Input
                                                id="last_name"
                                                value={formData.last_name}
                                                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                                required
                                                disabled={saving}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={profile?.email || ''}
                                            disabled
                                            className="bg-muted"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                                    </div>

                                    <div>
                                        <Label htmlFor="phone">Phone Number</Label>
                                        <Input
                                            id="phone"
                                            type="tel"
                                            placeholder="+1 (555) 123-4567"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            disabled={saving}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="bio">Bio</Label>
                                        <textarea
                                            id="bio"
                                            rows={4}
                                            placeholder="Tell us about yourself..."
                                            value={formData.bio}
                                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                            disabled={saving}
                                            className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground transition-smooth"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t">
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                Role: <span className="font-medium text-foreground">{profile?.role}</span>
                                            </p>
                                        </div>

                                        <Button type="submit" disabled={saving} className="gap-2">
                                            {saving ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4" />
                                                    Save Changes
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    {message && (
                                        <div
                                            className={`p-3 rounded-lg text-sm ${message.includes('success')
                                                    ? 'bg-accent/10 text-accent border border-accent/20'
                                                    : 'bg-destructive/10 text-destructive border border-destructive/20'
                                                }`}
                                        >
                                            {message}
                                        </div>
                                    )}
                                </form>
                            </Card>
                        </>
                    )}
                </motion.div>
            </main>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <ProfileContent />
        </ProtectedRoute>
    );
}
