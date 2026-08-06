// Dummy data source for the Team Members page. Shaped to match what the
// real GET /auth/team-members response will look like, so wiring the real
// API later is a drop-in swap inside useTeamMembers, not a rewrite.
export type TeamMemberStatus = 'active' | 'invited' | 'inactive';

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'manager';
  status: TeamMemberStatus;
  picture_url?: string | null;
  created_at: string;
}

export const MOCK_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'u1',
    full_name: 'Nishant Chaudhary',
    email: 'nishant@forgenest.io',
    role: 'owner',
    status: 'active',
    picture_url: null,
    created_at: '2026-06-01T09:00:00Z',
  },
  {
    id: 'u2',
    full_name: 'Priya Sharma',
    email: 'priya@forgenest.io',
    role: 'manager',
    status: 'active',
    picture_url: null,
    created_at: '2026-06-14T09:00:00Z',
  },
  {
    id: 'u3',
    full_name: 'Rajesh Karki',
    email: 'rajesh@forgenest.io',
    role: 'manager',
    status: 'invited',
    picture_url: null,
    created_at: '2026-08-02T09:00:00Z',
  },
  {
    id: 'u4',
    full_name: 'Anita Gurung',
    email: 'anita@forgenest.io',
    role: 'manager',
    status: 'inactive',
    picture_url: null,
    created_at: '2026-05-20T09:00:00Z',
  },
];
