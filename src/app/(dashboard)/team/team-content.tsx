'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Mail, UserPlus, Loader2, Trash2, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  joinedAt: Date | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  invitedAt: Date;
  expiresAt: Date;
  invitedByName: string | null;
}

interface TeamContentProps {
  team: {
    id: string;
    name: string;
    seatLimit: number;
    ownerId: string;
  };
  members: TeamMember[];
  pendingInvites: PendingInvite[];
  currentUserId: string;
}

export function TeamContent({ team, members, pendingInvites, currentUserId }: TeamContentProps) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const isOwner = currentUserId === team.ownerId;
  const totalSeatsUsed = members.length + pendingInvites.length;
  const canInvite = totalSeatsUsed < team.seatLimit;

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setIsInviting(true);
    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member');
      }

      toast.success('Member removed');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      const response = await fetch(`/api/team/invite?id=${inviteId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to revoke invitation');
      }

      toast.success('Invitation revoked');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke invitation');
    } finally {
      setRevokingId(null);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Team</h1>
        <p className="text-neutral-400 mt-1">
          Manage your team members and invitations
        </p>
      </div>

      {/* Team Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-300">
              Team Members
            </CardTitle>
            <Users className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {members.length}
            </div>
            <p className="text-xs text-neutral-400">of {team.seatLimit} seats used</p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-300">
              Pending Invitations
            </CardTitle>
            <Mail className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{pendingInvites.length}</div>
            <p className="text-xs text-neutral-400">awaiting response</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <Card className="bg-neutral-900/80 border-neutral-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Team Members</CardTitle>
            <CardDescription>
              People who have access to CodeBakers
            </CardDescription>
          </div>
          {isOwner && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  disabled={!canInvite}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-neutral-900 border-neutral-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your team
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-white"
                  />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'member' | 'admin')}>
                    <SelectTrigger className="bg-neutral-800 border-neutral-700 text-white">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleInvite}
                    disabled={isInviting}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Invitation'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-800">
                <TableHead className="text-neutral-300">Member</TableHead>
                <TableHead className="text-neutral-300">Role</TableHead>
                <TableHead className="text-neutral-300">Joined</TableHead>
                {isOwner && <TableHead className="text-neutral-300 w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id} className="border-neutral-800">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-red-600 text-white text-xs">
                          {getInitials(member.name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-white">{member.name || 'Unknown'}</p>
                        <p className="text-sm text-neutral-400">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.userId === team.ownerId ? 'default' : 'outline'}
                      className={
                        member.userId === team.ownerId
                          ? 'bg-red-600'
                          : 'border-neutral-600'
                      }
                    >
                      {member.userId === team.ownerId ? 'owner' : member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-neutral-400">
                    {member.joinedAt
                      ? new Date(member.joinedAt).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      {member.userId !== team.ownerId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingId === member.id}
                          className="text-neutral-400 hover:text-red-400"
                        >
                          {removingId === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card className="bg-neutral-900/80 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Invitations that haven't been accepted yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-800">
                  <TableHead className="text-neutral-300">Email</TableHead>
                  <TableHead className="text-neutral-300">Role</TableHead>
                  <TableHead className="text-neutral-300">Expires</TableHead>
                  {isOwner && <TableHead className="text-neutral-300 w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((invite) => (
                  <TableRow key={invite.id} className="border-neutral-800">
                    <TableCell className="text-white">{invite.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-neutral-600">
                        {invite.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-neutral-400">
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeInvite(invite.id)}
                          disabled={revokingId === invite.id}
                          className="text-neutral-400 hover:text-red-400"
                        >
                          {revokingId === invite.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Prompt */}
      {!canInvite && (
        <Card className="bg-red-900/30 border-red-700">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Need more seats?
              </h3>
              <p className="text-neutral-300">
                Upgrade to Team or Agency plan for more team members
              </p>
            </div>
            <Link href="/billing">
              <Button className="bg-white text-neutral-900 hover:bg-neutral-100">
                View Plans
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
