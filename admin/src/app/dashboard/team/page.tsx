import { redirect } from 'next/navigation';

// Team Members: commented out for launch, not needed yet. Redirects rather
// than deleting TeamMembersContent/useTeamMembers/the API — easy to restore
// by reverting this and the Sidebar.tsx nav entry.
export default function TeamPage() {
  redirect('/dashboard');
}
