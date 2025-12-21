'use client';

import { useState } from 'react';
import { Users, Mail, UserPlus, Loader2 } from 'lucide-react';
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

// Placeholder data - would come from API
const teamMembers = [
  {
    id: '1',
    email: 'owner@example.com',
    name: 'Team Owner',
    role: 'owner',
    joinedAt: new Date().toISOString(),
  },
];

export default function TeamPage() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setIsInviting(true);
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setDialogOpen(false);
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Team</h1>
        <p className="text-neutral-400 mt-1">
          Manage your team members and invitations
        </p>
      </div>

      {/* Team Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-neutral-800/50 border-neutral-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-300">
              Team Members
            </CardTitle>
            <Users className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {teamMembers.length}
            </div>
            <p className="text-xs text-neutral-400">of 1 seats used</p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-800/50 border-neutral-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-300">
              Pending Invitations
            </CardTitle>
            <Mail className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
            <p className="text-xs text-neutral-400">awaiting response</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <Card className="bg-neutral-800/50 border-neutral-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">Team Members</CardTitle>
            <CardDescription>
              People who have access to CodeBakers
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-800 border-neutral-700">
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
                  className="bg-neutral-700 border-neutral-600 text-white"
                />
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
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-700">
                <TableHead className="text-neutral-300">Member</TableHead>
                <TableHead className="text-neutral-300">Role</TableHead>
                <TableHead className="text-neutral-300">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id} className="border-neutral-700">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-red-600 text-white text-xs">
                          {member.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-white">{member.name}</p>
                        <p className="text-sm text-neutral-400">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.role === 'owner' ? 'default' : 'outline'}
                      className={
                        member.role === 'owner'
                          ? 'bg-red-600'
                          : 'border-neutral-600'
                      }
                    >
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-neutral-400">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Upgrade Prompt */}
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
          <Button className="bg-white text-neutral-900 hover:bg-neutral-100">
            View Plans
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
