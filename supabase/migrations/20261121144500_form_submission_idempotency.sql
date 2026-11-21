-- BloomSites uses a durable outbox for checkout and event marketing choices.
-- A single accepted form submission may therefore be delivered more than once.
-- Keep one accepted result per form/event while retaining rejected attempts for
-- abuse and validation evidence.
create unique index if not exists form_submissions_accepted_event_unique
  on public.form_submissions(form_id, ((metadata ->> 'event_id')))
  where result = 'accepted'
    and nullif(metadata ->> 'event_id', '') is not null;

comment on index public.form_submissions_accepted_event_unique is
  'Makes website and checkout form delivery idempotent without hiding rejected attempts.';
