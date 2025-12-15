'use client';

import { useState, useEffect } from 'react';
import {
  Loader2,
  Users,
  CreditCard,
  Crown,
  Search,
  Check,
  X,
  Ban,
  RefreshCw,
  MoreHorizontal,
  Download,
  AlertTriangle,
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

interface UserData {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  createdAt: string;
  team: {
    id: string;
    name: string;
    subscriptionPlan: string | null;
    subscriptionStatus: string | null;
    betaGrantedAt: string | null;
    betaGrantedReason: string | null;
    suspendedAt: string | null;
    suspendedReason: string | null;
    freeDownloadsUsed: number | null;
    freeDownloadsLimit: number | null;
  } | null;
}

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  betaUsers: number;
  suspendedUsers: number;
  planCounts: Record<string, number>;
}

type DialogType = 'beta' | 'suspend' | null;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [reason, setReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'trial'>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.data.users);
      setStats(data.data.stats);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = (user: UserData, type: DialogType) => {
    setSelectedUser(user);
    setDialogType(type);
    setReason('');
  };

  const closeDialog = () => {
    setSelectedUser(null);
    setDialogType(null);
    setReason('');
  };

  const toggleBeta = async (user: UserData, enable: boolean) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/beta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: enable,
          reason: enable ? reason : undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to update beta status');

      toast.success(
        enable ? 'Beta access granted' : 'Beta access revoked'
      );
      closeDialog();
      await fetchUsers();
    } catch (error) {
      toast.error('Failed to update beta status');
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleSuspend = async (user: UserData, suspend: boolean) => {
    if (suspend && !reason.trim()) {
      toast.error('Please provide a reason for suspension');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suspended: suspend,
          reason: suspend ? reason : undefined,
        }),
      });

      if (!response.ok) throw new Error('Failed to update suspension status');

      toast.success(
        suspend ? 'User suspended' : 'User unsuspended'
      );
      closeDialog();
      await fetchUsers();
    } catch (error) {
      toast.error('Failed to update suspension status');
    } finally {
      setIsUpdating(false);
    }
  };

  const resetTrial = async (user: UserData) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/reset-trial`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to reset trial');

      toast.success('Trial downloads reset');
      await fetchUsers();
    } catch (error) {
      toast.error('Failed to reset trial');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.fullName?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    switch (filterStatus) {
      case 'suspended':
        return user.team?.suspendedAt !== null;
      case 'active':
        return (
          user.team?.subscriptionStatus === 'active' ||
          user.team?.betaGrantedAt !== null
        ) && !user.team?.suspendedAt;
      case 'trial':
        return (
          !user.team?.subscriptionStatus ||
          user.team?.subscriptionStatus !== 'active'
        ) && !user.team?.betaGrantedAt && !user.team?.suspendedAt;
      default:
        return true;
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <p className="text-slate-400 mt-1">
          Manage users, subscriptions, and beta access
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {stats.totalUsers}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Active Subscriptions
              </CardTitle>
              <CreditCard className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {stats.activeSubscriptions}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Beta Users
              </CardTitle>
              <Crown className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {stats.betaUsers}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Pro Users
              </CardTitle>
              <CreditCard className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {stats.planCounts.pro || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Suspended
              </CardTitle>
              <Ban className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">
                {stats.suspendedUsers || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-white">All Users</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex gap-1">
                {(['all', 'active', 'suspended', 'trial'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus(status)}
                    className={
                      filterStatus === status
                        ? status === 'suspended'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-blue-600 hover:bg-blue-700'
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
                  placeholder="Search users..."
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">User</TableHead>
                  <TableHead className="text-slate-300">Team</TableHead>
                  <TableHead className="text-slate-300">Plan</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Trial Usage</TableHead>
                  <TableHead className="text-slate-300">Joined</TableHead>
                  <TableHead className="text-slate-300 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className={`border-slate-700 ${user.team?.suspendedAt ? 'bg-red-900/10' : ''}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">
                          {user.fullName || 'No name'}
                        </p>
                        <p className="text-sm text-slate-400">{user.email}</p>
                        <div className="flex gap-1 mt-1">
                          {user.isAdmin && (
                            <Badge className="bg-purple-600">Admin</Badge>
                          )}
                          {user.team?.suspendedAt && (
                            <Badge className="bg-red-600">
                              <Ban className="h-3 w-3 mr-1" />
                              Suspended
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {user.team?.name || 'No team'}
                    </TableCell>
                    <TableCell>
                      {user.team?.subscriptionPlan ? (
                        <Badge
                          className={
                            user.team.subscriptionPlan === 'beta'
                              ? 'bg-blue-600'
                              : 'bg-green-600'
                          }
                        >
                          {user.team.subscriptionPlan.toUpperCase()}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-slate-600 text-slate-400"
                        >
                          Free
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.team?.suspendedAt ? (
                        <Badge className="bg-red-600">Suspended</Badge>
                      ) : user.team?.subscriptionStatus === 'active' ||
                        user.team?.betaGrantedAt ? (
                        <Badge className="bg-green-600">Active</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-yellow-600 text-yellow-400"
                        >
                          Trial
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.team && !user.team.betaGrantedAt && user.team.subscriptionStatus !== 'active' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">
                            {user.team.freeDownloadsUsed ?? 0}/{user.team.freeDownloadsLimit ?? 3}
                          </span>
                          <Download className="h-3 w-3 text-slate-500" />
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString()}
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

                          {/* Beta Access */}
                          {user.team?.betaGrantedAt ? (
                            <DropdownMenuItem
                              onClick={() => toggleBeta(user, false)}
                              className="text-red-400 focus:bg-red-900/20 focus:text-red-400"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Revoke Beta
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => openDialog(user, 'beta')}
                              className="text-blue-400 focus:bg-blue-900/20 focus:text-blue-400"
                            >
                              <Crown className="h-4 w-4 mr-2" />
                              Grant Beta
                            </DropdownMenuItem>
                          )}

                          {/* Suspension */}
                          {user.team?.suspendedAt ? (
                            <DropdownMenuItem
                              onClick={() => toggleSuspend(user, false)}
                              className="text-green-400 focus:bg-green-900/20 focus:text-green-400"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Unsuspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => openDialog(user, 'suspend')}
                              className="text-red-400 focus:bg-red-900/20 focus:text-red-400"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Suspend
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator className="bg-slate-700" />

                          {/* Trial Reset */}
                          {user.team && !user.team.betaGrantedAt && user.team.subscriptionStatus !== 'active' && (
                            <DropdownMenuItem
                              onClick={() => resetTrial(user)}
                              className="text-slate-300 focus:bg-slate-700 focus:text-white"
                              disabled={isUpdating}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reset Trial
                            </DropdownMenuItem>
                          )}
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

      {/* Grant Beta Dialog */}
      <Dialog open={dialogType === 'beta'} onOpenChange={closeDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Grant Beta Access</DialogTitle>
            <DialogDescription>
              Grant free unlimited access to {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea
              placeholder="Reason for granting beta access (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => selectedUser && toggleBeta(selectedUser, true)}
                disabled={isUpdating}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Granting...
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    Grant Access
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={closeDialog}
                className="border-slate-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend User Dialog */}
      <Dialog open={dialogType === 'suspend'} onOpenChange={closeDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Suspend User
            </DialogTitle>
            <DialogDescription>
              Suspend {selectedUser?.email}'s access to the platform. They will not be able to use the CLI or access their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea
              placeholder="Reason for suspension (required)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => selectedUser && toggleSuspend(selectedUser, true)}
                disabled={isUpdating || !reason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Suspending...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Suspend User
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={closeDialog}
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
