import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { docketsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { getStatusColor, formatRelativeTime } from '../lib/utils';
import { extractDocketList } from '../lib/docket';

export default function Dashboard() {
  const { user } = useAuth();

  const { data: recentDockets } = useQuery({
    queryKey: ['dockets', 'recent'],
    queryFn: () => docketsApi.list({ limit: 5, sort: '-createdAt' }),
  });

  const { data: pendingDockets } = useQuery({
    queryKey: ['dockets', 'pending'],
    queryFn: () => docketsApi.list({ status: 'PENDING_APPROVAL', limit: 5 }),
  });

  const recentList = extractDocketList(recentDockets?.data);
  const pendingList = extractDocketList(pendingDockets?.data);

  const stats = [
    {
      label: 'Total Dockets',
      value: recentList.total || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-blue-500',
    },
    {
      label: 'Pending Approval',
      value: pendingList.total || 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-orange-500',
    },
    {
      label: 'My Assigned',
      value: 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      color: 'bg-green-500',
    },
    {
      label: 'Completed Today',
      value: 0,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.firstName || user?.username}
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your dockets today.
          </p>
        </div>
        <Link
          to="/dockets/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Docket
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`${stat.color} p-3 rounded-lg text-white`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Dockets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Dockets</CardTitle>
            <Link to="/dockets" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentList.items.length > 0 ? (
              <div className="space-y-4">
                {recentList.items.map((docket) => (
                  <Link
                    key={docket.id}
                    to={`/dockets/${docket.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium">{docket.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {docket.docketNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(docket.status)}`}>
                        {docket.status.replace('_', ' ')}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(docket.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No dockets yet. Create your first one!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pending Approval */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pending Approval</CardTitle>
            <Link to="/inbox" className="text-sm text-primary hover:underline">
              View inbox
            </Link>
          </CardHeader>
          <CardContent>
            {pendingList.items.length > 0 ? (
              <div className="space-y-4">
                {pendingList.items.map((docket) => (
                  <Link
                    key={docket.id}
                    to={`/dockets/${docket.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium">{docket.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {docket.docketNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
                        {docket.priority}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatRelativeTime(docket.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No dockets pending approval
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
