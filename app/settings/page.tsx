'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  User,
  Mail,
  Phone,
  MessageSquare,
  Bell,
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';

function SettingsContent() {
  const { user, updateUser, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: '',
    bio: '',
  });

  // Fetch full profile on mount (includes phone, bio)
  useEffect(() => {
    if (!user) return;
    const token = sessionStorage.getItem('auth_token');
    fetch('/api/users/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((profile: { phone?: string; bio?: string; first_name?: string; last_name?: string; email?: string }) => {
        setFormData((prev) => ({
          ...prev,
          first_name: profile.first_name || prev.first_name,
          last_name: profile.last_name || prev.last_name,
          email: profile.email || prev.email,
          phone: (profile as any).phone || '',
          bio: (profile as any).bio || '',
        }));
      })
      .catch(() => {});
  }, [user?.id]);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [notifications, setNotifications] = useState({
    task_assigned: true,
    task_completed: true,
    mention: true,
    message: true,
    digest: false,
  });

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone || undefined,
          bio: formData.bio || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      updateUser({
        ...user,
        first_name: formData.first_name,
        last_name: formData.last_name,
      });
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('Passwords do not match');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      alert('Password must be at least 8 characters with uppercase, lowercase, and number');
      return;
    }

    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('auth_token');
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      alert('Password changed successfully');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const sections = [
    {
      id: 'profile',
      label: 'Profile Settings',
      icon: User,
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      color: 'from-purple-500 to-purple-600',
    },
    {
      id: 'security',
      label: 'Security',
      icon: Lock,
      color: 'from-red-500 to-red-600',
    },
  ];

  const [activeSection, setActiveSection] = useState('profile');

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
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your profile and preferences
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <Card className="p-4 space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-smooth ${
                      activeSection === section.id
                        ? 'bg-primary text-white'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                );
              })}
            </Card>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 space-y-6"
          >
            {/* Profile Settings */}
            {activeSection === 'profile' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key="profile"
              >
                <Card className="p-6">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Profile Information
                  </h2>

                  {!isEditing ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-6 mb-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-3xl text-white">
                          {user?.first_name?.charAt(0)}
                          {user?.last_name?.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">
                            {user?.first_name} {user?.last_name}
                          </h3>
                          <p className="text-muted-foreground">{user?.email}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-secondary rounded-lg">
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
                            Role
                          </p>
                          <p className="text-lg font-semibold text-foreground capitalize">
                            {user?.role}
                          </p>
                        </div>
                        <div className="p-4 bg-secondary rounded-lg">
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
                            Member Since
                          </p>
                          <p className="text-lg font-semibold text-foreground">
                            Jan 2024
                          </p>
                        </div>
                      </div>

                      <Button
                        onClick={() => setIsEditing(true)}
                        className="w-full gap-2 btn-hover-lift"
                      >
                        <User className="w-4 h-4" />
                        Edit Profile
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>First Name</Label>
                          <Input
                            value={formData.first_name}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                first_name: e.target.value,
                              })
                            }
                            disabled={isLoading}
                          />
                        </div>
                        <div>
                          <Label>Last Name</Label>
                          <Input
                            value={formData.last_name}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                last_name: e.target.value,
                              })
                            }
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={formData.email}
                          disabled
                          className="opacity-75"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Email cannot be changed
                        </p>
                      </div>

                      <div>
                        <Label>Phone (Optional)</Label>
                        <Input
                          placeholder="+1 (555) 000-0000"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          disabled={isLoading}
                        />
                      </div>

                      <div>
                        <Label>Bio (Optional)</Label>
                        <textarea
                          placeholder="Tell us about yourself..."
                          value={formData.bio}
                          onChange={(e) =>
                            setFormData({ ...formData, bio: e.target.value })
                          }
                          disabled={isLoading}
                          rows={4}
                          className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground transition-smooth"
                        />
                      </div>

                      <div className="flex gap-3 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveProfile}
                          disabled={isLoading}
                          className="gap-2"
                        >
                          {isLoading ? (
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
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key="notifications"
              >
                <Card className="p-6">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Notification Preferences
                  </h2>

                  <div className="space-y-4">
                    {[
                      {
                        id: 'task_assigned',
                        label: 'Task Assigned',
                        description: 'Get notified when a task is assigned to you',
                        icon: User,
                      },
                      {
                        id: 'task_completed',
                        label: 'Task Completed',
                        description: 'Get notified when your tasks are completed',
                        icon: CheckCircle2,
                      },
                      {
                        id: 'mention',
                        label: 'Mentions',
                        description: 'Get notified when you are mentioned',
                        icon: Mail,
                      },
                      {
                        id: 'message',
                        label: 'Direct Messages',
                        description: 'Get notified for new direct messages',
                        icon: MessageSquare,
                      },
                      {
                        id: 'digest',
                        label: 'Weekly Digest',
                        description: 'Receive a weekly summary of team activity',
                        icon: Bell,
                      },
                    ].map((notif: any) => {
                      const Icon = notif.icon;
                      return (
                        <motion.div
                          key={notif.id}
                          whileHover={{ x: 5 }}
                          className="p-4 bg-secondary rounded-lg flex items-center justify-between hover:bg-secondary/80 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground">
                                {notif.label}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {notif.description}
                              </p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={
                              notifications[
                                notif.id as keyof typeof notifications
                              ]
                            }
                            onChange={(e) =>
                              setNotifications({
                                ...notifications,
                                [notif.id]: e.target.checked,
                              })
                            }
                            className="w-5 h-5 rounded cursor-pointer"
                          />
                        </motion.div>
                      );
                    })}
                  </div>

                  <Button className="w-full mt-6 gap-2 btn-hover-lift">
                    <Save className="w-4 h-4" />
                    Save Preferences
                  </Button>
                </Card>
              </motion.div>
            )}

            {/* Security */}
            {activeSection === 'security' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key="security"
              >
                <Card className="p-6">
                  <h2 className="text-2xl font-bold text-foreground mb-6">
                    Security Settings
                  </h2>

                  <div className="space-y-6">
                    {/* Change Password */}
                    <div className="p-6 bg-secondary rounded-lg">
                      <h3 className="text-lg font-semibold text-foreground mb-4">
                        Change Password
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <Label>Current Password</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter your current password"
                              value={passwordForm.current_password}
                              onChange={(e) =>
                                setPasswordForm({
                                  ...passwordForm,
                                  current_password: e.target.value,
                                })
                              }
                              disabled={isLoading}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>New Password</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter your new password"
                              value={passwordForm.new_password}
                              onChange={(e) =>
                                setPasswordForm({
                                  ...passwordForm,
                                  new_password: e.target.value,
                                })
                              }
                              disabled={isLoading}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Confirm Password</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Confirm your new password"
                              value={passwordForm.confirm_password}
                              onChange={(e) =>
                                setPasswordForm({
                                  ...passwordForm,
                                  confirm_password: e.target.value,
                                })
                              }
                              disabled={isLoading}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <Button
                          onClick={handleChangePassword}
                          disabled={isLoading}
                          className="w-full gap-2"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4" />
                              Update Password
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Active Sessions */}
                    <div className="p-6 bg-secondary rounded-lg">
                      <h3 className="text-lg font-semibold text-foreground mb-4">
                        Active Sessions
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        You have 2 active sessions
                      </p>
                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                        onClick={() => {
                          logout();
                        }}
                      >
                        Logout All Sessions
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
