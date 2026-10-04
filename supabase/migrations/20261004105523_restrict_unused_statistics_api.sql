-- Applied to pzplwtvnxikhykqsvcfs on 2026-10-04 (JST).
SET lock_timeout = '2s';
SET statement_timeout = '15s';
REVOKE ALL PRIVILEGES ON TABLE public.user_statistics, public.project_statistics FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_all_user_statistics() FROM PUBLIC, anon, authenticated;
ALTER VIEW public.user_statistics SET (security_invoker = true);
ALTER VIEW public.project_statistics SET (security_invoker = true);
