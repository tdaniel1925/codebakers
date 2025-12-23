import { db, teamInvites, teamMembers, teams, profiles } from '@/db';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export interface TeamInviteResult {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  invitedAt: Date;
  expiresAt: Date;
  invitedByName: string | null;
}

export interface TeamMemberInfo {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  joinedAt: Date | null;
}

export class TeamInviteService {
  /**
   * Create a new team invite
   */
  static async createInvite(
    teamId: string,
    email: string,
    role: string = 'member',
    invitedBy: string
  ): Promise<TeamInviteResult> {
    // Check if user already has a pending invite
    const existingInvite = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.teamId, teamId),
          eq(teamInvites.email, email.toLowerCase()),
          isNull(teamInvites.acceptedAt),
          gt(teamInvites.expiresAt, new Date())
        )
      )
      .limit(1);

    if (existingInvite.length > 0) {
      throw new Error('An invite is already pending for this email');
    }

    // Check if user is already a team member
    const existingProfile = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email.toLowerCase()))
      .limit(1);

    if (existingProfile.length > 0) {
      const existingMember = await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, existingProfile[0].id)
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        throw new Error('This user is already a team member');
      }
    }

    // Check seat limit
    const team = await db
      .select({ seatLimit: teams.seatLimit })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (team.length === 0) {
      throw new Error('Team not found');
    }

    const currentMemberCount = await this.getMemberCount(teamId);
    const pendingInviteCount = await this.getPendingInviteCount(teamId);

    if (team[0].seatLimit && currentMemberCount + pendingInviteCount >= team[0].seatLimit) {
      throw new Error('Team seat limit reached. Upgrade your plan for more seats.');
    }

    // Generate invite token
    const token = randomBytes(32).toString('hex');

    // Set expiry to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [invite] = await db
      .insert(teamInvites)
      .values({
        teamId,
        email: email.toLowerCase(),
        role,
        invitedBy,
        expiresAt,
        token,
      })
      .returning();

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      token: invite.token,
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * Accept an invite by token
   */
  static async acceptInvite(
    token: string,
    userId: string
  ): Promise<{ teamId: string; teamName: string }> {
    const [invite] = await db
      .select({
        id: teamInvites.id,
        teamId: teamInvites.teamId,
        email: teamInvites.email,
        role: teamInvites.role,
        acceptedAt: teamInvites.acceptedAt,
        expiresAt: teamInvites.expiresAt,
        teamName: teams.name,
      })
      .from(teamInvites)
      .innerJoin(teams, eq(teamInvites.teamId, teams.id))
      .where(eq(teamInvites.token, token))
      .limit(1);

    if (!invite) {
      throw new Error('Invalid or expired invite');
    }

    if (invite.acceptedAt) {
      throw new Error('This invite has already been used');
    }

    if (new Date() > invite.expiresAt) {
      throw new Error('This invite has expired');
    }

    // Check if user email matches invite email
    const [user] = await db
      .select({ email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error('This invite was sent to a different email address');
    }

    // Add user to team
    await db.insert(teamMembers).values({
      teamId: invite.teamId,
      userId,
      role: invite.role,
      joinedAt: new Date(),
    });

    // Mark invite as accepted
    await db
      .update(teamInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(teamInvites.id, invite.id));

    return {
      teamId: invite.teamId,
      teamName: invite.teamName,
    };
  }

  /**
   * Get pending invites for a team
   */
  static async getPendingInvites(teamId: string): Promise<PendingInvite[]> {
    const invites = await db
      .select({
        id: teamInvites.id,
        email: teamInvites.email,
        role: teamInvites.role,
        invitedAt: teamInvites.invitedAt,
        expiresAt: teamInvites.expiresAt,
        invitedByName: profiles.fullName,
      })
      .from(teamInvites)
      .leftJoin(profiles, eq(teamInvites.invitedBy, profiles.id))
      .where(
        and(
          eq(teamInvites.teamId, teamId),
          isNull(teamInvites.acceptedAt),
          gt(teamInvites.expiresAt, new Date())
        )
      );

    return invites;
  }

  /**
   * Revoke an invite
   */
  static async revokeInvite(inviteId: string, teamId: string): Promise<void> {
    const result = await db
      .delete(teamInvites)
      .where(
        and(
          eq(teamInvites.id, inviteId),
          eq(teamInvites.teamId, teamId),
          isNull(teamInvites.acceptedAt)
        )
      )
      .returning();

    if (result.length === 0) {
      throw new Error('Invite not found or already accepted');
    }
  }

  /**
   * Get team members
   */
  static async getTeamMembers(teamId: string): Promise<TeamMemberInfo[]> {
    const members = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        email: profiles.email,
        name: profiles.fullName,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(profiles, eq(teamMembers.userId, profiles.id))
      .where(eq(teamMembers.teamId, teamId));

    return members.map((m) => ({
      id: m.id,
      userId: m.userId || '',
      email: m.email,
      name: m.name,
      role: m.role || 'member',
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Remove a team member
   */
  static async removeMember(
    memberId: string,
    teamId: string,
    requesterId: string
  ): Promise<void> {
    // Get the team owner
    const [team] = await db
      .select({ ownerId: teams.ownerId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      throw new Error('Team not found');
    }

    // Get the member being removed
    const [member] = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)))
      .limit(1);

    if (!member) {
      throw new Error('Member not found');
    }

    // Cannot remove the team owner
    if (member.userId === team.ownerId) {
      throw new Error('Cannot remove the team owner');
    }

    // Only owner can remove members
    if (requesterId !== team.ownerId) {
      throw new Error('Only the team owner can remove members');
    }

    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)));
  }

  /**
   * Update member role
   */
  static async updateMemberRole(
    memberId: string,
    teamId: string,
    newRole: string,
    requesterId: string
  ): Promise<void> {
    // Get the team owner
    const [team] = await db
      .select({ ownerId: teams.ownerId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      throw new Error('Team not found');
    }

    // Only owner can change roles
    if (requesterId !== team.ownerId) {
      throw new Error('Only the team owner can change member roles');
    }

    await db
      .update(teamMembers)
      .set({ role: newRole })
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)));
  }

  /**
   * Get member count for a team
   */
  private static async getMemberCount(teamId: string): Promise<number> {
    const result = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    return result.length;
  }

  /**
   * Get pending invite count for a team
   */
  private static async getPendingInviteCount(teamId: string): Promise<number> {
    const result = await db
      .select({ id: teamInvites.id })
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.teamId, teamId),
          isNull(teamInvites.acceptedAt),
          gt(teamInvites.expiresAt, new Date())
        )
      );

    return result.length;
  }

  /**
   * Get invite by token (for validation)
   */
  static async getInviteByToken(token: string) {
    const [invite] = await db
      .select({
        id: teamInvites.id,
        email: teamInvites.email,
        role: teamInvites.role,
        expiresAt: teamInvites.expiresAt,
        acceptedAt: teamInvites.acceptedAt,
        teamName: teams.name,
      })
      .from(teamInvites)
      .innerJoin(teams, eq(teamInvites.teamId, teams.id))
      .where(eq(teamInvites.token, token))
      .limit(1);

    return invite || null;
  }
}
