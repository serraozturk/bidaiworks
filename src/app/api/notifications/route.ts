import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  notifyMessageCreated,
  notifyOfferAccepted,
  notifyOfferCreated,
  notifyOfferDeclined,
  notifyProjectCompleted,
} from '@/lib/notifications';

type NotificationEvent =
  | 'offer_created'
  | 'offer_accepted'
  | 'offer_declined'
  | 'message_created'
  | 'project_completed';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    event?: NotificationEvent;
    offerId?: string;
    messageId?: string;
    projectId?: string;
  } | null;

  if (!body?.event) {
    return NextResponse.json({ error: 'Missing event' }, { status: 400 });
  }

  const db = createAdminClient();

  if (
    ['offer_created', 'offer_accepted', 'offer_declined'].includes(body.event)
  ) {
    if (!body.offerId) {
      return NextResponse.json({ error: 'Missing offerId' }, { status: 400 });
    }

    const allowed = await userCanNotifyOffer(db, user.id, body.offerId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result =
      body.event === 'offer_created'
        ? await notifyOfferCreated(body.offerId)
        : body.event === 'offer_accepted'
          ? await notifyOfferAccepted(body.offerId)
          : await notifyOfferDeclined(body.offerId);

    return NextResponse.json({ ok: true, result });
  }

  if (body.event === 'message_created') {
    if (!body.messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    const allowed = await userCanNotifyMessage(db, user.id, body.messageId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await notifyMessageCreated(body.messageId);
    return NextResponse.json({ ok: true, result });
  }

  if (body.event === 'project_completed') {
    if (!body.projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const allowed = await userCanNotifyProject(db, user.id, body.projectId);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await notifyProjectCompleted(body.projectId);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ error: 'Unsupported event' }, { status: 400 });
}

async function userCanNotifyOffer(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  offerId: string,
) {
  const { data: offer } = await db
    .from('offers')
    .select('sender_id, recipient_id, project_id, projects(homeowner_id)')
    .eq('id', offerId)
    .maybeSingle();

  const homeownerId = firstRow<any>(offer?.projects)?.homeowner_id;
  return Boolean(
    offer &&
      [offer.sender_id, offer.recipient_id, homeownerId].filter(Boolean).includes(userId),
  );
}

async function userCanNotifyMessage(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  messageId: string,
) {
  const { data: message } = await db
    .from('messages')
    .select('sender_id, conversations(homeowner_id, contractor_id)')
    .eq('id', messageId)
    .maybeSingle();

  const conversation = firstRow<any>(message?.conversations);
  return Boolean(
    message &&
      message.sender_id === userId &&
      [conversation?.homeowner_id, conversation?.contractor_id].includes(userId),
  );
}

async function userCanNotifyProject(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  projectId: string,
) {
  const { data: project } = await db
    .from('projects')
    .select('homeowner_id')
    .eq('id', projectId)
    .maybeSingle();

  return project?.homeowner_id === userId;
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
