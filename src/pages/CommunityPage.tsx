import { Navigate } from 'react-router-dom';

/**
 * Community Stories was introduced as a UI-only experiment and never shipped
 * with its required tenant tables (ugc_submissions, staff_prompts, and
 * staff_prompt_responses). Keeping the route live causes PostgREST 404s for
 * authenticated users and advertises a feature that cannot persist data.
 *
 * BloomSuite's supported marketing workflow now lives in Campaigns, so keep
 * old bookmarks safe by routing them to the canonical marketing surface.
 */
export const CommunityPage = () => (
  <Navigate to="/crm/campaigns" replace />
);
