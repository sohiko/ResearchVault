-- Tested with synthetic fixtures before production application. No user data exported.
-- Applied after isolated verification and explicit production approval.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE private.project_link_grants (
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token uuid NOT NULL,
  PRIMARY KEY (user_id, session_id, project_id)
);
ALTER TABLE private.project_link_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.project_link_grants FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.project_access(p_id uuid, p_level text DEFAULT 'read')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = p_id AND (
      p.owner_id = auth.uid()
      OR (p.deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM public.project_members m
        WHERE m.project_id = p.id AND m.user_id = auth.uid()
          AND (p_level = 'read' OR (p_level = 'write' AND m.role IN ('editor','admin'))
            OR (p_level = 'manage' AND m.role = 'admin'))
      ))
      OR (p_level = 'read' AND p.deleted_at IS NULL AND p.is_link_sharing_enabled
        AND EXISTS (SELECT 1 FROM private.project_link_grants g
          WHERE g.project_id = p.id AND g.user_id = auth.uid()
            AND g.session_id = NULLIF(auth.jwt()->>'session_id','')::uuid
            AND g.token = p.link_sharing_token))
    )
  );
$$;
CREATE FUNCTION private.reference_access(p_id uuid, p_level text DEFAULT 'read')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public."references" r WHERE r.id = p_id AND (
    (r.project_id IS NULL AND r.saved_by = auth.uid())
    OR (r.project_id IS NOT NULL AND private.project_access(r.project_id,p_level))
  ) AND (p_level <> 'read' OR r.deleted_at IS NULL OR r.saved_by = auth.uid()
    OR private.project_access(r.project_id,'manage')));
$$;
CREATE FUNCTION private.child_access(p_reference uuid,p_project uuid,p_creator uuid,p_level text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND CASE
    WHEN p_reference IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public."references" r WHERE r.id=p_reference
        AND r.project_id IS NOT DISTINCT FROM p_project
        AND private.reference_access(r.id,p_level))
    WHEN p_project IS NOT NULL THEN private.project_access(p_project,p_level)
    ELSE p_creator=auth.uid() END;
$$;
CREATE FUNCTION private.is_app_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((auth.jwt()->'app_metadata'->>'is_admin') = 'true',false);
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

CREATE FUNCTION public.authorize_project_link(p_project_id uuid,p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE session_uuid uuid := NULLIF(auth.jwt()->>'session_id','')::uuid;
BEGIN
  IF auth.uid() IS NULL OR session_uuid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id=p_project_id AND deleted_at IS NULL
      AND is_link_sharing_enabled AND link_sharing_token=p_token
  ) THEN RAISE EXCEPTION 'Invalid sharing link' USING ERRCODE='42501'; END IF;
  INSERT INTO private.project_link_grants VALUES(auth.uid(),session_uuid,p_project_id,p_token)
  ON CONFLICT(user_id,session_id,project_id) DO UPDATE SET token=EXCLUDED.token;
END;
$$;
CREATE FUNCTION public.get_project_people(p_project_id uuid)
RETURNS TABLE(id uuid,name text,role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pr.id,pr.name,CASE WHEN pr.id=p.owner_id THEN 'owner' ELSE m.role END
  FROM public.projects p JOIN public.profiles pr ON pr.id=p.owner_id
    OR EXISTS(SELECT 1 FROM public.project_members pm WHERE pm.project_id=p.id AND pm.user_id=pr.id)
  LEFT JOIN public.project_members m ON m.project_id=p.id AND m.user_id=pr.id
  WHERE p.id=p_project_id AND private.project_access(p.id,'read');
$$;
CREATE FUNCTION public.find_project_invitee(p_project_id uuid,p_email text)
RETURNS TABLE(id uuid,name text,email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.project_access(p_project_id,'manage') THEN
    RAISE EXCEPTION 'Project management permission required' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT pr.id,pr.name,pr.email FROM public.profiles pr
    WHERE lower(pr.email)=lower(trim(p_email));
END;
$$;
CREATE FUNCTION public.get_feedback_authors()
RETURNS TABLE(id uuid,name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id,p.name FROM public.profiles p WHERE private.is_app_admin()
    AND EXISTS(SELECT 1 FROM public.feature_requests f WHERE f.user_id=p.id AND f.deleted_at IS NULL);
$$;

-- Replace, rather than add to, the permissive legacy policies (which combine by OR).
DO $$ DECLARE pol record; BEGIN
  FOR pol IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN
    ('profiles','projects','project_members','references','selected_texts','bookmarks',
     'activity_logs','project_invitations','feature_requests','reference_tags','tags')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I',pol.policyname,pol.tablename); END LOOP;
END $$;

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK(id=auth.uid());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
REVOKE INSERT,UPDATE,DELETE ON public.profiles FROM PUBLIC,anon,authenticated;
GRANT INSERT(id,email,name,avatar_url,created_at,updated_at) ON public.profiles TO authenticated;
GRANT UPDATE(name,avatar_url,gemini_api_key,gemini_api_key_enabled,updated_at) ON public.profiles TO authenticated;

CREATE POLICY projects_read ON public.projects FOR SELECT TO authenticated USING(private.project_access(id,'read'));
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid());
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated USING(private.project_access(id,'write')) WITH CHECK(private.project_access(id,'write'));
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated USING(owner_id=auth.uid());
CREATE POLICY members_read ON public.project_members FOR SELECT TO authenticated USING(private.project_access(project_id,'read'));
CREATE POLICY members_insert ON public.project_members FOR INSERT TO authenticated WITH CHECK(private.project_access(project_id,'manage'));
CREATE POLICY members_update ON public.project_members FOR UPDATE TO authenticated USING(private.project_access(project_id,'manage')) WITH CHECK(private.project_access(project_id,'manage'));
CREATE POLICY members_delete ON public.project_members FOR DELETE TO authenticated USING(user_id=auth.uid() OR private.project_access(project_id,'manage'));

CREATE POLICY references_read ON public."references" FOR SELECT TO authenticated USING(private.reference_access(id,'read'));
CREATE POLICY references_insert ON public."references" FOR INSERT TO authenticated WITH CHECK(saved_by=auth.uid() AND (project_id IS NULL OR private.project_access(project_id,'write')));
CREATE POLICY references_update ON public."references" FOR UPDATE TO authenticated USING(private.reference_access(id,'write')) WITH CHECK(project_id IS NULL AND saved_by=auth.uid() OR private.project_access(project_id,'write'));
CREATE POLICY references_delete ON public."references" FOR DELETE TO authenticated USING(private.reference_access(id,'write'));

DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY['selected_texts','bookmarks'] LOOP
    EXECUTE format('CREATE POLICY child_read ON public.%I FOR SELECT TO authenticated USING(private.child_access(reference_id,project_id,created_by,''read''))',tbl);
    EXECUTE format('CREATE POLICY child_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND private.child_access(reference_id,project_id,created_by,''write''))',tbl);
    EXECUTE format('CREATE POLICY child_update ON public.%I FOR UPDATE TO authenticated USING(private.child_access(reference_id,project_id,created_by,''write'')) WITH CHECK(private.child_access(reference_id,project_id,created_by,''write''))',tbl);
    EXECUTE format('CREATE POLICY child_delete ON public.%I FOR DELETE TO authenticated USING(private.child_access(reference_id,project_id,created_by,''write''))',tbl);
  END LOOP;
END $$;
CREATE POLICY logs_read ON public.activity_logs FOR SELECT TO authenticated USING(user_id=auth.uid() OR private.project_access(project_id,'manage'));
REVOKE INSERT,UPDATE,DELETE ON public.activity_logs FROM PUBLIC,anon,authenticated;
CREATE POLICY invitations_read ON public.project_invitations FOR SELECT TO authenticated USING(inviter_id=auth.uid() OR invitee_id=auth.uid());
CREATE POLICY invitations_insert ON public.project_invitations FOR INSERT TO authenticated WITH CHECK(inviter_id=auth.uid() AND private.project_access(project_id,'manage'));
CREATE POLICY invitations_update ON public.project_invitations FOR UPDATE TO authenticated USING(private.project_access(project_id,'manage')) WITH CHECK(private.project_access(project_id,'manage'));
CREATE POLICY invitations_delete ON public.project_invitations FOR DELETE TO authenticated USING(private.project_access(project_id,'manage'));
-- Bind mail recipients to the registered invitee; prevent changing an existing
-- invitation into a message to a different person or project.
CREATE FUNCTION private.guard_invitation_target() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.inviter_id IS DISTINCT FROM OLD.inviter_id
    OR NEW.invitee_id IS DISTINCT FROM OLD.invitee_id
    OR NEW.invitee_email IS DISTINCT FROM OLD.invitee_email) THEN
    RAISE EXCEPTION 'Immutable invitation recipient' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=NEW.invitee_id
    AND lower(p.email)=lower(trim(NEW.invitee_email))) THEN
    RAISE EXCEPTION 'Invitation recipient mismatch' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_invitation_target BEFORE INSERT OR UPDATE ON public.project_invitations
FOR EACH ROW EXECUTE FUNCTION private.guard_invitation_target();
CREATE FUNCTION public.respond_project_invitation(p_invitation_id uuid,p_status text)
RETURNS public.project_invitations LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.project_invitations;
BEGIN
  SELECT * INTO invitation FROM public.project_invitations WHERE id=p_invitation_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR invitation.status<>'pending'
    OR NOT (p_status IN ('accepted','rejected') AND invitation.invitee_id=auth.uid()
      OR p_status='cancelled' AND invitation.inviter_id=auth.uid()) THEN
    RAISE EXCEPTION 'Invitation response not permitted' USING ERRCODE='42501'; END IF;
  IF p_status='accepted' THEN
    IF NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=invitation.project_id AND p.deleted_at IS NULL
      AND (p.owner_id=invitation.inviter_id OR EXISTS(SELECT 1 FROM public.project_members m
        WHERE m.project_id=p.id AND m.user_id=invitation.inviter_id AND m.role='admin'))) THEN
      RAISE EXCEPTION 'Invitation no longer valid' USING ERRCODE='42501'; END IF;
    INSERT INTO public.project_members(project_id,user_id,role)
      VALUES(invitation.project_id,invitation.invitee_id,invitation.role)
      ON CONFLICT(project_id,user_id) DO NOTHING;
  END IF;
  UPDATE public.project_invitations SET status=p_status,responded_at=now()
    WHERE id=invitation.id RETURNING * INTO invitation;
  RETURN invitation;
END;
$$;
CREATE POLICY feedback_read ON public.feature_requests FOR SELECT TO authenticated USING(user_id=auth.uid() OR private.is_app_admin());
CREATE POLICY feedback_insert ON public.feature_requests FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY feedback_update ON public.feature_requests FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY reference_tags_read ON public.reference_tags FOR SELECT TO authenticated USING(private.reference_access(reference_id,'read'));
CREATE POLICY reference_tags_write ON public.reference_tags FOR ALL TO authenticated USING(private.reference_access(reference_id,'write')) WITH CHECK(private.reference_access(reference_id,'write'));
CREATE POLICY tags_read ON public.tags FOR SELECT TO authenticated USING(created_by=auth.uid() OR EXISTS(SELECT 1 FROM public.reference_tags rt WHERE rt.tag_id=tags.id));
CREATE POLICY tags_insert ON public.tags FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid());
CREATE POLICY tags_update ON public.tags FOR UPDATE TO authenticated USING(created_by=auth.uid()) WITH CHECK(created_by=auth.uid());

-- Protect attribution, owner and relation IDs even when both source and target are writable.
CREATE FUNCTION private.guard_resource_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user NOT IN ('anon','authenticated') THEN RETURN NEW; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Immutable ID' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='projects' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN RAISE EXCEPTION 'Immutable owner' USING ERRCODE='42501'; END IF;
    IF OLD.owner_id<>auth.uid() AND (NEW.link_sharing_token IS DISTINCT FROM OLD.link_sharing_token
      OR NEW.is_link_sharing_enabled IS DISTINCT FROM OLD.is_link_sharing_enabled
      OR NEW.is_public IS DISTINCT FROM OLD.is_public
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN
      RAISE EXCEPTION 'Owner permission required' USING ERRCODE='42501'; END IF;
  ELSIF TG_TABLE_NAME='references' THEN
    IF NEW.saved_by IS DISTINCT FROM OLD.saved_by THEN RAISE EXCEPTION 'Immutable author' USING ERRCODE='42501'; END IF;
    IF NEW.project_id IS DISTINCT FROM OLD.project_id AND OLD.saved_by<>auth.uid() THEN
      RAISE EXCEPTION 'Only author can move reference' USING ERRCODE='42501'; END IF;
  ELSE
    IF NEW.created_by IS DISTINCT FROM OLD.created_by OR (OLD.created_by<>auth.uid()
      AND (NEW.reference_id IS DISTINCT FROM OLD.reference_id OR NEW.project_id IS DISTINCT FROM OLD.project_id)) THEN
      RAISE EXCEPTION 'Immutable attribution or unauthorized move' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_project_identity BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION private.guard_resource_identity();
CREATE TRIGGER guard_reference_identity BEFORE UPDATE ON public."references" FOR EACH ROW EXECUTE FUNCTION private.guard_resource_identity();
CREATE TRIGGER guard_text_identity BEFORE UPDATE ON public.selected_texts FOR EACH ROW EXECUTE FUNCTION private.guard_resource_identity();
CREATE TRIGGER guard_bookmark_identity BEFORE UPDATE ON public.bookmarks FOR EACH ROW EXECUTE FUNCTION private.guard_resource_identity();

CREATE OR REPLACE FUNCTION public.log_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row_data jsonb; actor uuid; project_uuid uuid;
BEGIN
  row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  actor:=COALESCE(auth.uid(),(row_data->>'saved_by')::uuid,(row_data->>'owner_id')::uuid);
  project_uuid:=CASE WHEN TG_OP='DELETE' THEN NULL WHEN TG_TABLE_NAME='projects' THEN (row_data->>'id')::uuid ELSE (row_data->>'project_id')::uuid END;
  INSERT INTO public.activity_logs(user_id,project_id,action,resource_type,resource_id,details)
  VALUES(actor,project_uuid,TG_OP,TG_TABLE_NAME,(row_data->>'id')::uuid,jsonb_build_object('operation',TG_OP,'table',TG_TABLE_NAME));
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE OR REPLACE FUNCTION public.regenerate_link_sharing_token(p_project_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_token uuid;
BEGIN
  UPDATE public.projects SET link_sharing_token=pg_catalog.gen_random_uuid(),updated_at=now()
  WHERE id=p_project_id AND owner_id=auth.uid() RETURNING link_sharing_token INTO new_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only project owner can regenerate sharing token' USING ERRCODE='42501'; END IF;
  DELETE FROM private.project_link_grants WHERE project_id=p_project_id;
  RETURN new_token;
END;
$$;
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.cleanup_old_trash() SET search_path = public, pg_temp;
ALTER FUNCTION public.soft_delete_project_references() SET search_path = public, pg_temp;

REVOKE ALL ON public.user_statistics,public.project_statistics FROM PUBLIC,anon,authenticated;
ALTER VIEW public.user_statistics SET(security_invoker=true);
ALTER VIEW public.project_statistics SET(security_invoker=true);
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_project_link(uuid,uuid),public.get_project_people(uuid),
  public.find_project_invitee(uuid,text),public.regenerate_link_sharing_token(uuid),
  public.respond_project_invitation(uuid,text),public.get_feedback_authors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon;

-- Existing is_admin flags are not promoted automatically: they were client-writable.
-- Only trusted Auth app_metadata is used for application-wide administrator authorization.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon;
NOTIFY pgrst, 'reload schema';
