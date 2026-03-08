import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { authApi, notificationsApi } from '../lib/api';
import {
  DEFAULT_APPEARANCE,
  applyAppearancePreferences,
  loadAppearancePreferences,
  saveAppearancePreferences,
  type AppearancePreferences,
  type FontSizePreference,
  type ThemePreference,
} from '../lib/appearance';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

type SettingsTab = 'profile' | 'notifications' | 'security' | 'appearance';

function isSettingsTab(tab: string | null): tab is SettingsTab {
  return tab === 'profile' || tab === 'notifications' || tab === 'security' || tab === 'appearance';
}

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout, refreshUser } = useAuth();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<SettingsTab>(isSettingsTab(initialTab) ? initialTab : 'profile');
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [preferences, setPreferences] = useState({
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    deliveryMode: 'immediate' as 'immediate' | 'digest',
    digestFrequency: 'daily' as 'daily' | 'weekly',
  });
  const [appearance, setAppearance] = useState<AppearancePreferences>(DEFAULT_APPEARANCE);

  const { data: preferencesData } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationsApi.getPreferences(),
  });

  const { data: capabilitiesData } = useQuery({
    queryKey: ['notification-capabilities'],
    queryFn: () => notificationsApi.getCapabilities(),
  });

  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
  }, [user]);

  useEffect(() => {
    const raw = preferencesData?.data?.data ?? preferencesData?.data;
    if (!raw || typeof raw !== 'object') return;
    const payload = raw as Partial<typeof preferences>;
    setPreferences((prev) => ({ ...prev, ...payload }));
  }, [preferencesData]);

  useEffect(() => {
    const saved = loadAppearancePreferences();
    setAppearance(saved);
    applyAppearancePreferences(saved);
  }, []);

  useEffect(() => {
    if (appearance.theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyAppearancePreferences(appearance);

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }

    media.addListener(listener);
    return () => media.removeListener(listener);
  }, [appearance]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (isSettingsTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const savePreferencesMutation = useMutation({
    mutationFn: () => notificationsApi.updatePreferences({
      ...preferences,
      emailEnabled: emailConfigured ? preferences.emailEnabled : false,
      smsEnabled: smsConfigured && !!capabilities.phoneNumber ? preferences.smsEnabled : false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      alert('Notification preferences saved.');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to save notification preferences.';
      alert(Array.isArray(message) ? message.join(', ') : String(message));
    },
  });

  const sendDigestMutation = useMutation({
    mutationFn: () => notificationsApi.sendDigest(),
    onSuccess: (response: any) => {
      const message = response?.data?.message || 'Digest request submitted.';
      alert(String(message));
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to send digest.';
      alert(Array.isArray(message) ? message.join(', ') : String(message));
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: () => authApi.updateProfile(profileForm),
    onSuccess: async () => {
      await refreshUser();
      alert('Profile updated successfully.');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to update profile.';
      alert(Array.isArray(message) ? message.join(', ') : String(message));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword({
      currentPassword: securityForm.currentPassword,
      newPassword: securityForm.newPassword,
    }),
    onSuccess: async () => {
      alert('Password changed successfully. Please log in again.');
      await logout();
      navigate('/login', { replace: true });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Failed to change password.';
      alert(Array.isArray(message) ? message.join(', ') : String(message));
    },
  });

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { id: 'security', label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { id: 'appearance', label: 'Appearance', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  ];

  const capabilitiesRaw = capabilitiesData?.data?.data ?? capabilitiesData?.data;
  const capabilities = (capabilitiesRaw && typeof capabilitiesRaw === 'object'
    ? capabilitiesRaw
    : {}) as {
      emailConfigured?: boolean;
      smsConfigured?: boolean;
      emailAddress?: string | null;
      phoneNumber?: string | null;
    };

  const emailConfigured = capabilities.emailConfigured === true;
  const smsConfigured = capabilities.smsConfigured === true;

  const updateAppearancePreview = (partial: Partial<AppearancePreferences>) => {
    setAppearance((prev) => {
      const next = { ...prev, ...partial };
      applyAppearancePreferences(next);
      return next;
    });
  };

  const saveAppearance = () => {
    saveAppearancePreferences(appearance);
    alert('Appearance preferences saved.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your profile details and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-medium">
                    {(user?.firstName?.[0] || user?.username?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <Button variant="outline" size="sm">Change Avatar</Button>
                    <p className="text-sm text-muted-foreground mt-1">JPG, PNG or GIF. Max 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1234567890"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" defaultValue={user?.username || ''} disabled />
                  <p className="text-sm text-muted-foreground">Username cannot be changed</p>
                </div>

                <Button
                  onClick={() => updateProfileMutation.mutate()}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  In-app notifications (bell and inbox) are active in this deployment. Email/SMS require provider setup by administrator.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        {emailConfigured
                          ? `Delivered to ${capabilities.emailAddress || user?.email || 'your profile email'}`
                          : 'Not configured on server (requires SendGrid credentials).'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.emailEnabled}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, emailEnabled: e.target.checked }))}
                        disabled={!emailConfigured}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        {smsConfigured
                          ? (capabilities.phoneNumber
                            ? `Delivered to ${capabilities.phoneNumber}`
                            : 'Set your phone number in Profile to enable SMS.')
                          : 'Not configured on server (requires Twilio credentials).'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.smsEnabled}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, smsEnabled: e.target.checked }))}
                        disabled={!smsConfigured || !capabilities.phoneNumber}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">In-app Notifications</p>
                      <p className="text-sm text-muted-foreground">Show notifications in the DOCQR bell/inbox</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.inAppEnabled}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, inAppEnabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">Quiet Hours</p>
                      <p className="text-sm text-muted-foreground">Pause email/SMS in selected hours</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.quietHoursEnabled}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, quietHoursEnabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border">
                    <div className="space-y-2">
                      <Label htmlFor="quietHoursStart">Quiet Hours Start</Label>
                      <Input
                        id="quietHoursStart"
                        type="time"
                        value={preferences.quietHoursStart || '22:00'}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, quietHoursStart: e.target.value }))}
                        disabled={!preferences.quietHoursEnabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quietHoursEnd">Quiet Hours End</Label>
                      <Input
                        id="quietHoursEnd"
                        type="time"
                        value={preferences.quietHoursEnd || '07:00'}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, quietHoursEnd: e.target.value }))}
                        disabled={!preferences.quietHoursEnabled}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border">
                    <div className="space-y-2">
                      <Label htmlFor="deliveryMode">Delivery Mode</Label>
                      <select
                        id="deliveryMode"
                        value={preferences.deliveryMode}
                        onChange={(e) => setPreferences((prev) => ({
                          ...prev,
                          deliveryMode: e.target.value as 'immediate' | 'digest',
                        }))}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="immediate">Immediate</option>
                        <option value="digest">Digest</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="digestFrequency">Digest Frequency</Label>
                      <select
                        id="digestFrequency"
                        value={preferences.digestFrequency}
                        onChange={(e) => setPreferences((prev) => ({
                          ...prev,
                          digestFrequency: e.target.value as 'daily' | 'weekly',
                        }))}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        disabled={preferences.deliveryMode !== 'digest'}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => savePreferencesMutation.mutate()}
                    disabled={savePreferencesMutation.isPending}
                  >
                    {savePreferencesMutation.isPending ? 'Saving...' : 'Save Preferences'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => sendDigestMutation.mutate()}
                    disabled={sendDigestMutation.isPending || !emailConfigured}
                  >
                    {sendDigestMutation.isPending ? 'Sending...' : 'Send Test Digest'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your password and security options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg border">
                  <h3 className="font-medium mb-2">Change Password</h3>
                  <p className="text-sm text-muted-foreground mb-4">Update your password regularly to keep your account secure</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={securityForm.currentPassword}
                        onChange={(e) => setSecurityForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={securityForm.newPassword}
                        onChange={(e) => setSecurityForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={securityForm.confirmPassword}
                        onChange={(e) => setSecurityForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (!securityForm.currentPassword || !securityForm.newPassword || !securityForm.confirmPassword) {
                          alert('Please fill in all password fields.');
                          return;
                        }
                        if (securityForm.newPassword !== securityForm.confirmPassword) {
                          alert('New password and confirm password do not match.');
                          return;
                        }
                        if (securityForm.newPassword.length < 8) {
                          alert('New password must be at least 8 characters.');
                          return;
                        }
                        changePasswordMutation.mutate();
                      }}
                      disabled={changePasswordMutation.isPending}
                    >
                      {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <h3 className="font-medium mb-2">Two-Factor Authentication</h3>
                  <p className="text-sm text-muted-foreground mb-4">Add an extra layer of security to your account</p>
                  <Button variant="outline" disabled>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    2FA Not Enabled In This Deployment
                  </Button>
                </div>

                <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                  <h3 className="font-medium text-destructive mb-2">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <Button variant="destructive" disabled>Delete Account</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
                <CardDescription>Customize the look and feel of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="mb-4 block">Theme</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {([
                      { id: 'light', label: 'Light', previewClass: 'bg-white border' },
                      { id: 'dark', label: 'Dark', previewClass: 'bg-gray-900' },
                      { id: 'system', label: 'System', previewClass: 'bg-gradient-to-br from-white to-gray-900' },
                    ] as { id: ThemePreference; label: string; previewClass: string }[]).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateAppearancePreview({ theme: option.id })}
                        className={`p-4 rounded-lg border-2 text-center ${
                          appearance.theme === option.id ? 'border-primary' : 'border-transparent hover:border-muted'
                        }`}
                      >
                        <div className={`w-full aspect-video rounded mb-2 ${option.previewClass}`}></div>
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-4 block">Accent Color</Label>
                  <div className="flex gap-3">
                    {['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateAppearancePreview({ accentColor: color })}
                        className={`w-10 h-10 rounded-full border-2 ${
                          appearance.accentColor === color ? 'border-gray-900' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-4 block">Font Size</Label>
                  <div className="flex gap-4">
                    {([
                      { id: 'small', label: 'Small', className: 'text-sm' },
                      { id: 'default', label: 'Default', className: '' },
                      { id: 'large', label: 'Large', className: 'text-lg' },
                    ] as { id: FontSizePreference; label: string; className: string }[]).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateAppearancePreview({ fontSize: option.id })}
                        className={`px-4 py-2 rounded-lg border ${
                          appearance.fontSize === option.id ? 'border-2 border-primary' : 'hover:border-primary'
                        } ${option.className}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="button" onClick={saveAppearance}>Save Preferences</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
