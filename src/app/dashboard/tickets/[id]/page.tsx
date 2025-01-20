import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TicketDetailContent from './TicketDetailContent';

export default async function TicketDetail({ params }: { params: { id: string } }) {
  const { id } = await params;
  const supabase = createServerComponentClient({ 
    cookies
  });

  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user || userError) {
    redirect('/auth?type=admin');
  }

  // Get user's organization
  const { data: memberData, error: memberError } = await supabase
    .from('org_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();

  if (memberError || !memberData) {
    console.error('Error fetching member data:', memberError);
    redirect('/auth?type=admin');
  }

  // Fetch ticket details
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .eq('organization_id', memberData.organization_id)
    .single();

  if (ticketError || !ticket) {
    console.error('Error fetching ticket:', ticketError);
    redirect('/dashboard/tickets');
  }

  // Fetch comments with user data
  const { data: comments, error: commentsError } = await supabase
    .from('ticket_comments')
    .select(`
      id,
      ticket_id,
      comment_text,
      created_at,
      created_by,
      commenter_name
    `)
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  if (commentsError) {
    console.error('Error fetching comments:', commentsError.message, commentsError.details, commentsError.hint);
    redirect('/dashboard/tickets');
  }

  return (
    <TicketDetailContent
      initialTicket={ticket}
      initialComments={comments || []}
      organizationId={memberData.organization_id}
    />
  );
} 