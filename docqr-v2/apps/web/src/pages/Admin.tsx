import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatDate } from '../lib/utils';

function downloadCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: unknown) => {
    const text = String(value ?? '');
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => escapeCell(row[key])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Admin() {
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.stats(),
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-audit-logs', auditPage, auditSearch],
    queryFn: () => adminApi.auditLogs({
      page: auditPage,
      limit: 20,
      search: auditSearch || undefined,
    }),
  });

  const { data: slaData } = useQuery({
    queryKey: ['admin-report-sla'],
    queryFn: () => adminApi.slaReport(),
  });

  const { data: workloadData } = useQuery({
    queryKey: ['admin-report-workload'],
    queryFn: () => adminApi.workloadReport(),
  });

  const { data: turnaroundData } = useQuery({
    queryKey: ['admin-report-turnaround'],
    queryFn: () => adminApi.turnaroundReport(),
  });

  const stats = statsData?.data || {};
  const auditLogs = auditData?.data?.data || [];
  const auditMeta = auditData?.data?.meta || { page: 1, totalPages: 1, total: 0 };
  const sla = slaData?.data || {};
  const workload = workloadData?.data || {};
  const turnaround = turnaroundData?.data || {};

  const auditExportRows = useMemo(
    () => auditLogs.map((log: any) => ({
      timestamp: log.createdAt,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId || '',
      user: log.user?.username || '',
      requestPath: log.requestPath || '',
    })),
    [auditLogs],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Reports</h1>
        <p className="text-muted-foreground">System analytics, SLA, workload and audit visibility</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Dockets</p>
            <p className="text-2xl font-bold">{statsLoading ? '...' : (stats?.totals?.totalDockets || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Open Dockets</p>
            <p className="text-2xl font-bold">{statsLoading ? '...' : (stats?.totals?.openDockets || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Closed Dockets</p>
            <p className="text-2xl font-bold">{statsLoading ? '...' : (stats?.totals?.closedDockets || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Archived Dockets</p>
            <p className="text-2xl font-bold">{statsLoading ? '...' : (stats?.totals?.archivedDockets || 0)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>SLA Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>On track: <span className="font-semibold">{sla?.summary?.onTrack || 0}</span></p>
            <p>At risk: <span className="font-semibold">{sla?.summary?.atRisk || 0}</span></p>
            <p>Overdue: <span className="font-semibold text-destructive">{sla?.summary?.overdue || 0}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Turnaround Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Samples: <span className="font-semibold">{turnaround?.summary?.sampleSize || 0}</span></p>
            <p>
              Avg turnaround (hours):
              <span className="font-semibold ml-1">
                {Number(turnaround?.summary?.averageTurnaroundHours || 0).toFixed(2)}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workload by User</CardTitle>
        </CardHeader>
        <CardContent>
          {(workload?.byUser?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 text-sm">User</th>
                    <th className="text-left px-4 py-2 text-sm">Open Dockets</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {workload.byUser.map((item: any) => (
                    <tr key={`${item.userId || 'none'}-${item.userName}`}>
                      <td className="px-4 py-2">{item.userName}</td>
                      <td className="px-4 py-2">{item.docketCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No workload data</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Audit Logs</CardTitle>
          <div className="flex items-center gap-2">
            <input
              value={auditSearch}
              onChange={(e) => {
                setAuditSearch(e.target.value);
                setAuditPage(1);
              }}
              placeholder="Search logs..."
              className="h-9 px-3 rounded border bg-background text-sm"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadCsv(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, auditExportRows)}
            >
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading audit logs...</div>
          ) : auditLogs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No audit logs found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 text-sm">Timestamp</th>
                      <th className="text-left px-4 py-2 text-sm">Action</th>
                      <th className="text-left px-4 py-2 text-sm">Resource</th>
                      <th className="text-left px-4 py-2 text-sm">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditLogs.map((log: any) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2 text-sm">{formatDate(log.createdAt)}</td>
                        <td className="px-4 py-2 text-sm font-medium">{log.action}</td>
                        <td className="px-4 py-2 text-sm">
                          {log.resourceType}
                          {log.resourceId ? ` (${log.resourceId.slice(0, 8)}...)` : ''}
                        </td>
                        <td className="px-4 py-2 text-sm">{log.user?.username || 'system'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">Total: {auditMeta.total}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={auditMeta.page <= 1}
                    onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={auditMeta.page >= auditMeta.totalPages}
                    onClick={() => setAuditPage((prev) => prev + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
