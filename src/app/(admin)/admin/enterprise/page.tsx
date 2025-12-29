'use client';

import { useState, useEffect } from 'react';
import {
  Loader2,
  Building2,
  Mail,
  Users,
  Clock,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface EnterpriseInquiry {
  id: string;
  name: string;
  email: string;
  company: string;
  teamSize: string | null;
  useCase: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  respondedAt: string | null;
}

interface Stats {
  total: number;
  new: number;
  contacted: number;
  converted: number;
  declined: number;
}

type StatusType = 'new' | 'contacted' | 'converted' | 'declined';

export default function AdminEnterprisePage() {
  const [inquiries, setInquiries] = useState<EnterpriseInquiry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | StatusType>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<EnterpriseInquiry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    try {
      const response = await fetch('/api/admin/enterprise');
      if (!response.ok) throw new Error('Failed to fetch inquiries');
      const data = await response.json();
      setInquiries(data.inquiries);
      setStats(data.stats);
    } catch (error) {
      toast.error('Failed to load enterprise inquiries');
    } finally {
      setIsLoading(false);
    }
  };

  const openNotesDialog = (inquiry: EnterpriseInquiry) => {
    setSelectedInquiry(inquiry);
    setNotes(inquiry.notes || '');
    setDialogOpen(true);
  };

  const updateStatus = async (inquiry: EnterpriseInquiry, status: StatusType) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/enterprise/${inquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      toast.success(`Status updated to ${status}`);
      await fetchInquiries();
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const saveNotes = async () => {
    if (!selectedInquiry) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/enterprise/${selectedInquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) throw new Error('Failed to save notes');

      toast.success('Notes saved');
      setDialogOpen(false);
      await fetchInquiries();
    } catch (error) {
      toast.error('Failed to save notes');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-blue-600">New</Badge>;
      case 'contacted':
        return <Badge className="bg-yellow-600">Contacted</Badge>;
      case 'converted':
        return <Badge className="bg-green-600">Converted</Badge>;
      case 'declined':
        return <Badge className="bg-red-600">Declined</Badge>;
      default:
        return <Badge className="bg-slate-600">{status}</Badge>;
    }
  };

  const filteredInquiries = inquiries.filter((inquiry) => {
    const matchesSearch =
      inquiry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.company.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === 'all') return true;
    return inquiry.status === filterStatus;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Enterprise Leads</h1>
        <p className="text-slate-400 mt-1">
          Manage enterprise plan inquiries and track conversions
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Total Inquiries
              </CardTitle>
              <Building2 className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                New Leads
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">{stats.new}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Contacted
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400">{stats.contacted}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Converted
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">{stats.converted}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Declined
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{stats.declined}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Inquiries Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-white">All Inquiries</CardTitle>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchInquiries()}
                disabled={isLoading}
                className="border-slate-600 text-slate-300"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <div className="flex gap-1">
                {(['all', 'new', 'contacted', 'converted', 'declined'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus(status)}
                    className={
                      filterStatus === status
                        ? status === 'new'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : status === 'converted'
                          ? 'bg-green-600 hover:bg-green-700'
                          : status === 'declined'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-slate-600 hover:bg-slate-700'
                        : 'border-slate-600 text-slate-300'
                    }
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search inquiries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No enterprise inquiries yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">Contact</TableHead>
                  <TableHead className="text-slate-300">Company</TableHead>
                  <TableHead className="text-slate-300">Team Size</TableHead>
                  <TableHead className="text-slate-300">Use Case</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Date</TableHead>
                  <TableHead className="text-slate-300 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInquiries.map((inquiry) => (
                  <TableRow
                    key={inquiry.id}
                    className={`border-slate-700 ${
                      inquiry.status === 'new' ? 'bg-blue-900/10' : ''
                    }`}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{inquiry.name}</p>
                        <a
                          href={`mailto:${inquiry.email}`}
                          className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          {inquiry.email}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-white">{inquiry.company}</p>
                    </TableCell>
                    <TableCell>
                      {inquiry.teamSize ? (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Users className="h-4 w-4" />
                          {inquiry.teamSize}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-slate-400 max-w-xs truncate">
                        {inquiry.useCase || '-'}
                      </p>
                    </TableCell>
                    <TableCell>{getStatusBadge(inquiry.status)}</TableCell>
                    <TableCell className="text-slate-400">
                      {new Date(inquiry.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                          <DropdownMenuLabel className="text-slate-300">Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-slate-700" />

                          <DropdownMenuItem
                            onClick={() => openNotesDialog(inquiry)}
                            className="text-slate-300 focus:bg-slate-700 focus:text-white"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Add Notes
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="bg-slate-700" />

                          <DropdownMenuLabel className="text-slate-400 text-xs">
                            Set Status
                          </DropdownMenuLabel>

                          <DropdownMenuItem
                            onClick={() => updateStatus(inquiry, 'contacted')}
                            className="text-yellow-400 focus:bg-yellow-900/20 focus:text-yellow-400"
                            disabled={isUpdating}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Mark Contacted
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => updateStatus(inquiry, 'converted')}
                            className="text-green-400 focus:bg-green-900/20 focus:text-green-400"
                            disabled={isUpdating}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Converted
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => updateStatus(inquiry, 'declined')}
                            className="text-red-400 focus:bg-red-900/20 focus:text-red-400"
                            disabled={isUpdating}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Mark Declined
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => updateStatus(inquiry, 'new')}
                            className="text-blue-400 focus:bg-blue-900/20 focus:text-blue-400"
                            disabled={isUpdating}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Reset to New
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Notes Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Notes for {selectedInquiry?.company}</DialogTitle>
            <DialogDescription>
              Add internal notes about this inquiry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {selectedInquiry?.useCase && (
              <div className="p-3 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Use Case:</p>
                <p className="text-sm text-slate-200">{selectedInquiry.useCase}</p>
              </div>
            )}
            <Textarea
              placeholder="Add notes about this inquiry..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white min-h-[120px]"
            />
            <div className="flex gap-2">
              <Button
                onClick={saveNotes}
                disabled={isUpdating}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Notes'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-slate-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
