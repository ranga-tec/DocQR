import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { docketsApi } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { getStatusColor, getPriorityColor, formatRelativeTime } from '../../lib/utils';
import { extractDocketList, type NormalizedDocket } from '../../lib/docket';
import { useAuth } from '../../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'FORWARDED', label: 'Forwarded' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
];

function getActorLabel(actor?: NormalizedDocket['createdBy']): string {
  return actor?.fullName || actor?.firstName || actor?.username || 'Unknown';
}

function getExternalSenderLabel(docket: NormalizedDocket): string {
  return docket.senderName || docket.senderOrganization || getActorLabel(docket.createdBy);
}

function getRoutingSenderLabel(docket: NormalizedDocket): string {
  return getActorLabel(docket.currentAssignment?.assignedBy || docket.createdBy);
}

function getCurrentHolderLabel(docket: NormalizedDocket): string {
  const holder = docket.currentAssignee || docket.currentAssignment?.assignedTo;
  return holder ? getActorLabel(holder) : 'Awaiting assignment';
}

function getLocationLabel(docket: NormalizedDocket): string {
  return docket.currentDepartment?.name
    || docket.currentAssignment?.assignedToDepartment?.name
    || 'Not assigned';
}

function getProgressLabel(docket: NormalizedDocket): string {
  if (docket.progressSummary) {
    return docket.progressSummary;
  }

  return docket.status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^\w/, (value) => value.toUpperCase());
}

export default function DocketsList() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const canCreateDocket = hasPermission('docket:create');

  const status = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const { data, isLoading } = useQuery({
    queryKey: ['dockets', { status, search, page }],
    queryFn: () =>
      docketsApi.list({
        status: status || undefined,
        search: search || undefined,
        page,
        limit: 10,
      }),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams((prev) => {
      prev.set('search', search);
      prev.delete('page');
      return prev;
    });
  };

  const handleStatusChange = (newStatus: string) => {
    setSearchParams((prev) => {
      if (newStatus) {
        prev.set('status', newStatus);
      } else {
        prev.delete('status');
      }
      prev.delete('page');
      return prev;
    });
  };

  const docketList = extractDocketList(data?.data);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dockets</h1>
          <p className="text-muted-foreground">
            Manage and track all document dockets
          </p>
        </div>
        {canCreateDocket ? (
          <Link to="/dockets/new">
            <Button>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Docket
            </Button>
          </Link>
        ) : null}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  type="search"
                  placeholder="Search dockets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>

            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Dockets List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>All Dockets</span>
            {docketList.total > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {docketList.total} total
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : docketList.items.length > 0 ? (
            <div className="space-y-2">
              {docketList.items.map((docket) => (
                <Link
                  key={docket.id}
                  to={`/dockets/${docket.id}`}
                  className="block p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-muted-foreground font-mono">
                          {docket.docketNumber}
                        </span>
                        {docket.docketType && (
                          <span className="text-xs px-2 py-0.5 bg-secondary rounded">
                            {docket.docketType.name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium truncate">{docket.subject}</h3>
                      {docket.description && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {docket.description}
                        </p>
                      )}
                      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            From
                          </p>
                          <p className="truncate font-medium">{getExternalSenderLabel(docket)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Sent By
                          </p>
                          <p className="truncate font-medium">{getRoutingSenderLabel(docket)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Current Holder
                          </p>
                          <p className="truncate font-medium">{getCurrentHolderLabel(docket)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Location
                          </p>
                          <p className="truncate font-medium">{getLocationLabel(docket)}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-sm">
                        <span className="font-medium">Progress:</span>{' '}
                        {getProgressLabel(docket)}
                      </div>
                      {(docket.currentAssignment?.instructions || docket.currentAssignment?.comments) && (
                        <div className="mt-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Instruction:</span>{' '}
                          {docket.currentAssignment?.instructions || docket.currentAssignment?.comments}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span>
                          Created by {docket.createdBy?.firstName || docket.createdBy?.username || 'Unknown'}
                        </span>
                        <span>{formatRelativeTime(docket.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(docket.status)}`}>
                        {docket.status.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded border ${getPriorityColor(docket.priority)}`}>
                        {docket.priority}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Pagination */}
              {docketList.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() =>
                      setSearchParams((prev) => {
                        prev.set('page', String(page - 1));
                        return prev;
                      })
                    }
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {docketList.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= docketList.totalPages}
                    onClick={() =>
                      setSearchParams((prev) => {
                        prev.set('page', String(page + 1));
                        return prev;
                      })
                    }
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg
                className="w-12 h-12 mx-auto text-muted-foreground mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="font-medium mb-1">No dockets found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search || status
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first docket'}
              </p>
              {!search && !status && canCreateDocket && (
                <Link to="/dockets/new">
                  <Button>Create Docket</Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
