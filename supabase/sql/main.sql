-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  project_id uuid,
  action character varying NOT NULL,
  resource_type character varying,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT activity_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.bookmarks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reference_id uuid,
  element_xpath text,
  scroll_position integer DEFAULT 0,
  label character varying,
  screenshot text,
  project_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT bookmarks_pkey PRIMARY KEY (id),
  CONSTRAINT bookmarks_reference_id_fkey FOREIGN KEY (reference_id) REFERENCES public.references(id),
  CONSTRAINT bookmarks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT bookmarks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.browsing_history_candidates (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  url text,
  title text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  subject character varying CHECK (subject::text = ANY (ARRAY['国語'::character varying, '数学'::character varying, '歴史'::character varying, '物理'::character varying, '生物'::character varying, '化学'::character varying, '地理'::character varying, '英語'::character varying, '音楽'::character varying, '美術'::character varying, '技術'::character varying, '家庭科'::character varying, 'その他'::character varying]::text[])),
  subject_confidence numeric DEFAULT NULL::numeric CHECK (subject_confidence >= 0::numeric AND subject_confidence <= 1::numeric),
  ai_classified boolean DEFAULT false,
  classification_result jsonb,
  classified_at timestamp with time zone,
  user_id uuid NOT NULL,
  visited_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  visit_count integer DEFAULT 1,
  confidence_score numeric DEFAULT 0.5 CHECK (confidence_score >= 0::numeric AND confidence_score <= 1::numeric),
  suggested_reason character varying,
  is_academic boolean DEFAULT false,
  category character varying,
  dismissed boolean DEFAULT false,
  dismissed_at timestamp with time zone,
  favicon text,
  CONSTRAINT browsing_history_candidates_pkey PRIMARY KEY (id),
  CONSTRAINT browsing_history_candidates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.citation_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE,
  default_style character varying DEFAULT 'APA'::character varying CHECK (default_style::text = ANY (ARRAY['APA'::character varying, 'MLA'::character varying, 'Chicago'::character varying, 'Harvard'::character varying, 'IEEE'::character varying]::text[])),
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT citation_settings_pkey PRIMARY KEY (id),
  CONSTRAINT citation_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.feature_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title character varying NOT NULL,
  description text NOT NULL,
  type character varying DEFAULT 'feature'::character varying CHECK (type::text = ANY (ARRAY['feature'::character varying, 'bug'::character varying, 'improvement'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at timestamp with time zone,
  CONSTRAINT feature_requests_pkey PRIMARY KEY (id),
  CONSTRAINT feature_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  name text,
  avatar_url text,
  gemini_api_key text,
  gemini_api_key_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  is_admin boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.project_invitations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  invitee_email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer'::text CHECK (role = ANY (ARRAY['viewer'::text, 'editor'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text])),
  message text,
  email_sent_at timestamp with time zone,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT project_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT project_invitations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.profiles(id),
  CONSTRAINT project_invitations_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.project_members (
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer'::text CHECK (role = ANY (ARRAY['viewer'::text, 'editor'::text, 'admin'::text])),
  joined_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT project_members_pkey PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text,
  owner_id uuid,
  color character varying DEFAULT '#3b82f6'::character varying,
  icon text DEFAULT '📂'::text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at timestamp with time zone,
  deleted_by uuid,
  is_public boolean NOT NULL DEFAULT false,
  is_link_sharing_enabled boolean NOT NULL DEFAULT false,
  link_sharing_token uuid DEFAULT uuid_generate_v4(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id),
  CONSTRAINT projects_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id)
);
CREATE TABLE public.reference_tags (
  reference_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  CONSTRAINT reference_tags_pkey PRIMARY KEY (reference_id, tag_id),
  CONSTRAINT reference_tags_reference_id_fkey FOREIGN KEY (reference_id) REFERENCES public.references(id),
  CONSTRAINT reference_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.references (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  project_id uuid,
  url text NOT NULL,
  title character varying,
  favicon text,
  saved_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  saved_by uuid,
  memo text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at timestamp with time zone,
  deleted_by uuid,
  published_date date,
  accessed_date date,
  reference_type text CHECK (reference_type = ANY (ARRAY['website'::text, 'article'::text, 'journal'::text, 'book'::text, 'report'::text])),
  authors jsonb DEFAULT '[]'::jsonb,
  publisher text,
  pages text,
  isbn text,
  doi text,
  online_link text,
  journal_name text,
  volume text,
  issue text,
  edition text,
  is_online boolean DEFAULT false,
  language text DEFAULT 'ja'::text,
  CONSTRAINT references_pkey PRIMARY KEY (id),
  CONSTRAINT references_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT references_saved_by_fkey FOREIGN KEY (saved_by) REFERENCES public.profiles(id),
  CONSTRAINT references_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id)
);
CREATE TABLE public.selected_texts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reference_id uuid,
  text text NOT NULL,
  xpath text,
  context_before character varying,
  context_after character varying,
  highlight_color character varying DEFAULT '#ffeb3b'::character varying,
  project_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  pdf_page integer,
  pdf_position jsonb,
  CONSTRAINT selected_texts_pkey PRIMARY KEY (id),
  CONSTRAINT selected_texts_reference_id_fkey FOREIGN KEY (reference_id) REFERENCES public.references(id),
  CONSTRAINT selected_texts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT selected_texts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL UNIQUE,
  color character varying DEFAULT '#6b7280'::character varying,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT tags_pkey PRIMARY KEY (id),
  CONSTRAINT tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
