import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationsApi } from '../../lib/api';
import { formatRelativeTime } from '../../lib/utils';
import { Button } from '../ui/button';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

function extractNotifications(payload: unknown): NotificationItem[] {
  if (!payload || typeof payload !== 'object') return [];

  const root = payload as { data?: unknown };
  if (Array.isArray(root.data)) {
    return root.data as NotificationItem[];
  }

  return [];
}

export default function Header() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30000,
  });

  const { data: notificationsData, isFetching: isLoadingNotifications } = useQuery({
    queryKey: ['notifications', 'header'],
    queryFn: () => notificationsApi.list({ limit: 8 }),
    enabled: showNotifications,
    refetchInterval: showNotifications ? 15000 : false,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'header'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'header'] });
    },
  });

  const unreadCount = unreadData?.data?.count || 0;
  const notifications = extractNotifications(notificationsData?.data);

  const handleLogout = async () => {
    await logout();
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await markAsReadMutation.mutateAsync(notification.id);
    }

    setShowNotifications(false);
    navigate(notification.actionUrl || '/inbox');
  };

  const initials = user
    ? `${user.firstName?.[0] || user.username[0]}${user.lastName?.[0] || ''}`.toUpperCase()
    : '?';

  return (
    <header className="h-16 border-b bg-card px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Document Workflow System</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowDropdown(false);
            }}
            className="relative p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
            aria-label="Notifications"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>

          {showNotifications ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-card border rounded-md shadow-lg z-20">
                <div className="px-3 py-2 border-b flex items-center justify-between">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unreadCount > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-1 text-xs"
                      onClick={() => markAllAsReadMutation.mutate()}
                      disabled={markAllAsReadMutation.isPending}
                    >
                      Mark all read
                    </Button>
                  ) : null}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {isLoadingNotifications ? (
                    <p className="px-3 py-6 text-sm text-muted-foreground text-center">Loading notifications...</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-3 py-6 text-sm text-muted-foreground text-center">No notifications</p>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left px-3 py-3 border-b last:border-b-0 hover:bg-accent/60 ${
                          notification.isRead ? '' : 'bg-primary/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium">{notification.title}</p>
                          {!notification.isRead ? (
                            <span className="mt-1 inline-block w-2 h-2 rounded-full bg-primary" />
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-2">{formatRelativeTime(notification.createdAt)}</p>
                      </button>
                    ))
                  )}
                </div>
                <div className="px-3 py-2 border-t">
                  <Link
                    to="/inbox"
                    onClick={() => setShowNotifications(false)}
                    className="text-sm text-primary hover:underline"
                  >
                    Open Inbox
                  </Link>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDropdown(!showDropdown);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1 rounded-md hover:bg-accent"
          >
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium">
                {user?.firstName || user?.username}
              </p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-card border rounded-md shadow-lg z-20">
                <div className="p-2">
                  <Link
                    to="/settings?tab=profile"
                    onClick={() => setShowDropdown(false)}
                    className="block px-3 py-2 text-sm rounded-md hover:bg-accent"
                  >
                    Profile
                  </Link>
                  <Link
                    to="/settings?tab=security"
                    onClick={() => setShowDropdown(false)}
                    className="block px-3 py-2 text-sm rounded-md hover:bg-accent"
                  >
                    Change Password
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setShowDropdown(false)}
                    className="block px-3 py-2 text-sm rounded-md hover:bg-accent"
                  >
                    Settings
                  </Link>
                  <hr className="my-2" />
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    Sign out
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
