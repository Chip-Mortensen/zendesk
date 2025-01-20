import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import CustomerTicketDetailContent from './TicketDetailContent';

export default async function CustomerTicketDetail({ params }: { params: { orgSlug: string; id: string } }) {
  const { orgSlug, id } = await params;
  const supabase = createServerComponentClient({ 
    cookies
  });

  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user || userError) {
    redirect('/login');
  }

  // Get user's organization
  const { data: memberData } = await supabase
    .from('member_details')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_slug', orgSlug)
    .single();

  if (!memberData?.organization_id) {
    redirect('/login');
  }

  // Fetch ticket details
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .eq('organization_id', memberData.organization_id)
    .eq('created_by', user.id)  // Only allow viewing own tickets
    .single();

  if (ticketError || !ticket) {
    console.error('Error fetching ticket:', ticketError);
    redirect(`/org/${orgSlug}/tickets`);
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
    redirect(`/org/${orgSlug}/tickets`);
  }

  return (
    <CustomerTicketDetailContent
      initialTicket={ticket}
      initialComments={comments || []}
      organizationId={memberData.organization_id}
      orgSlug={orgSlug}
    />
  );
} 