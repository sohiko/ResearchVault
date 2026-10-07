-- Synthetic fixtures only. This must always end with ROLLBACK.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('91000000-0000-4000-8000-000000000001','return-owner@fixture.invalid'),
 ('91000000-0000-4000-8000-000000000002','return-member@fixture.invalid');
INSERT INTO public.projects(id,name,owner_id) VALUES
 ('91000000-0000-4000-8000-000000000003','returning-fixture','91000000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r public."references"; BEGIN
 INSERT INTO public."references"(url,title,saved_by) VALUES
 ('https://fixture.invalid/private.pdf','Private PDF','91000000-0000-4000-8000-000000000001') RETURNING * INTO r;
 IF r.title IS DISTINCT FROM 'Private PDF' THEN RAISE EXCEPTION 'Private insert returning failed'; END IF;
 INSERT INTO public."references"(url,title,saved_by,project_id) VALUES
 ('https://fixture.invalid/owner.pdf','Owner PDF','91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003') RETURNING * INTO r;
 IF r.title IS DISTINCT FROM 'Owner PDF' THEN RAISE EXCEPTION 'Owner insert returning failed'; END IF;
 UPDATE public."references" SET title='Updated PDF' WHERE id=r.id RETURNING * INTO r;
 IF r.title IS DISTINCT FROM 'Updated PDF' THEN RAISE EXCEPTION 'Update returning failed'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.project_members(project_id,user_id,role) VALUES
 ('91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002','viewer');
SELECT set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE returned uuid; BEGIN
 IF EXISTS(SELECT 1 FROM public."references" WHERE url='https://fixture.invalid/private.pdf') THEN RAISE EXCEPTION 'Private reference leaked'; END IF;
 BEGIN
  INSERT INTO public."references"(url,saved_by,project_id) VALUES
  ('https://fixture.invalid/denied.pdf','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003') RETURNING id INTO returned;
  RAISE EXCEPTION 'Viewer insert was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.project_members SET role='editor' WHERE user_id='91000000-0000-4000-8000-000000000002' AND project_id='91000000-0000-4000-8000-000000000003';
SET LOCAL ROLE authenticated;
DO $$ DECLARE r public."references"; BEGIN
 INSERT INTO public."references"(url,title,saved_by,project_id) VALUES
 ('https://fixture.invalid/editor.pdf','Editor PDF','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003') RETURNING * INTO r;
 IF r.title IS DISTINCT FROM 'Editor PDF' THEN RAISE EXCEPTION 'Editor insert returning failed'; END IF;
 BEGIN
  INSERT INTO public."references"(url,saved_by) VALUES
  ('https://fixture.invalid/forged.pdf','91000000-0000-4000-8000-000000000001') RETURNING * INTO r;
  RAISE EXCEPTION 'Forged author was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SET LOCAL ROLE anon;
DO $$ DECLARE returned uuid; BEGIN
 BEGIN
  INSERT INTO public."references"(url,saved_by) VALUES
  ('https://fixture.invalid/anonymous.pdf','91000000-0000-4000-8000-000000000001') RETURNING id INTO returned;
  RAISE EXCEPTION 'Anonymous insert was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
