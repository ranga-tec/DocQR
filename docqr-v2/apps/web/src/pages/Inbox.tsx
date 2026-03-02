import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { docketsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { getStatusColor, getPriorityColor, formatDate } from '../lib/utils';
import { extractDocketList } from '../lib/docket';

type FilterTab = 'pending' | 'action_required' | 'forwarded' | 'all';

export default function Inbox() {
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');

  // Fetch dockets assigned to current user
  const { data, isLoading } = useQuery({
    queryKey: ['inbox', activeTab],
    queryFn: () => docketsApi.list({
      assignedToMe: true,
      status: activeTab === 'all' ? undefined : getStatusFilter(activeTab),
    }),
  });

  const docketList = extractDocketList(data?.data);
  const dockets = docketList.items;

  function getStatusFilter(tab: FilterTab): string | undefined {
    switch (tab) {
      case 'pending': return 'IN_REVIEW';
      case 'action_required': return 'PENDING_APPROVAL';
      case 'forwarded': return 'FORWARDED';
      default: return undefined;
    }
  }

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'pending', label: 'Pending Review' },
    { id: 'action_required', label: 'Action Required' },
    { id: 'forwarded', label: 'Forwarded to Me' },
    { id: 'all', label: 'All Assigned' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Inbox</h1>
          <p className="text-muted-foreground">Dockets assigned to you for review or action</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : dockets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">No dockets here</h3>
            <p className="text-muted-foreground">
              {activeTab === 'pending' && "You don't have any dockets pending review."}
              {activeTab === 'action_required' && "No dockets require your action."}
              {activeTab === 'forwarded' && "No dockets have been forwarded to you."}
              {activeTab === 'all' && "You don't have any assigned dockets."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dockets.map((docket) => (
            <Card key={docket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-muted-foreground font-mono">
                        {docket.docketNumber}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(docket.status)}`}>
                        {docket.status.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded border ${getPriorityColor(docket.priority)}`}>
                        {docket.priority}
                      </span>
                    </div>
                    <Link
                      to={`/dockets/${docket.id}`}
                      className="text-lg font-medium hover:text-primary transition-colors"
                    >
                      {docket.subject}
                    </Link>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>From: {docket.createdBy?.firstName || docket.createdBy?.username}</span>
                      {docket.docketType && <span>Type: {docket.docketType.name}</span>}
                      <span>Received: {formatDate(docket.createdAt)}</span>
                    </div>
                    {docket.currentAssignment?.instructions && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        <span className="font-medium">Instructions: </span>
                        {docket.currentAssignment.instructions}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/dockets/${docket.id}`}>
                      <Button size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
