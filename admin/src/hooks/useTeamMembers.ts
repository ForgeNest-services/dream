'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MOCK_TEAM_MEMBERS, type TeamMember, type TeamMemberStatus } from '@/lib/mock-team';

export interface InviteTeamMemberInput {
  full_name: string;
  email: string;
  role: 'manager';
}

// TODO(team-api): swap this in-memory state for GET/POST/PATCH/DELETE
// /auth/team-members once the backend endpoints exist. Call shapes below
// are already written to match what those calls will look like.
export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>(MOCK_TEAM_MEMBERS);
  const [isMutating, setIsMutating] = useState(false);

  const invite = async (input: InviteTeamMemberInput): Promise<boolean> => {
    setIsMutating(true);
    if (members.some((m) => m.email.toLowerCase() === input.email.toLowerCase())) {
      toast.error('This email is already registered.');
      setIsMutating(false);
      return false;
    }
    const newMember: TeamMember = {
      id: `u${Date.now()}`,
      full_name: input.full_name,
      email: input.email,
      role: input.role,
      status: 'invited',
      picture_url: null,
      created_at: new Date().toISOString(),
    };
    setMembers((prev) => [...prev, newMember]);
    toast.success(`Invitation sent to ${input.email}`);
    setIsMutating(false);
    return true;
  };

  const setStatus = (id: string, status: TeamMemberStatus) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    toast.success(status === 'active' ? 'Member activated' : 'Member deactivated');
  };

  const update = async (id: string, changes: Partial<Pick<TeamMember, 'full_name' | 'role'>>): Promise<boolean> => {
    setIsMutating(true);
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));
    toast.success('Team member updated');
    setIsMutating(false);
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    setIsMutating(true);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast.success('Team member removed');
    setIsMutating(false);
    return true;
  };

  return { members, isLoading: false, isMutating, invite, setStatus, update, remove };
}
