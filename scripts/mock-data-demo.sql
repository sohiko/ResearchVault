-- ResearchVault モックアップ用ダミーデータ投入スクリプト
-- coder.programming.code@gmail.com 向け。実行すると対象ユーザーの既存データを安全に入れ替えます。
-- psql などでそのまま流せる再実行可能な形式です。

set search_path = public;
create extension if not exists "pgcrypto";

DO $$
DECLARE
  target_email text := 'coder.programming.code@gmail.com';
  default_password text := 'DemoPass!234';

  -- ユーザー
  target_user_id uuid;
  collaborator_id uuid;
  reviewer_id uuid;

  -- プロジェクト
  p_ai uuid;
  p_climate uuid;
  p_methods uuid;

  -- タグ
  tag_ai uuid;
  tag_policy uuid;
  tag_climate uuid;
  tag_methods uuid;

  -- 参照
  ref_guardrails uuid;
  ref_eval uuid;
  ref_green uuid;
  ref_health uuid;
  ref_prompt uuid;
  ref_extension uuid;
BEGIN
  ----------------------------------------------------------------------------
  -- ユーザーを確保（存在しなければ作成）
  ----------------------------------------------------------------------------
  SELECT id
    INTO target_user_id
    FROM auth.users
    WHERE email = target_email
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target user % does not exist in auth.users. 一度ログインしてください。', target_email;
  END IF;

  -- 協力者・レビュアーは、存在すればその id、なければ target_user_id を使う（FK衝突を避ける）
  SELECT id
    INTO collaborator_id
    FROM auth.users
    WHERE email = 'hayashi.researcher@example.com'
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
  IF collaborator_id IS NULL THEN
    collaborator_id := target_user_id;
  END IF;

  SELECT id
    INTO reviewer_id
    FROM auth.users
    WHERE email = 'sato.designer@example.com'
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1;
  IF reviewer_id IS NULL THEN
    reviewer_id := target_user_id;
  END IF;

  ----------------------------------------------------------------------------
  -- 既存データのクリア（対象ユーザーのみ）
  ----------------------------------------------------------------------------
  -- 可変スキーマに耐えるよう、存在チェックを挟む
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reference_tags') THEN
    DELETE FROM reference_tags WHERE reference_id IN (SELECT r.id FROM "references" r WHERE r.saved_by = target_user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'selected_texts') THEN
    DELETE FROM selected_texts WHERE reference_id IN (SELECT r.id FROM "references" r WHERE r.saved_by = target_user_id) OR created_by = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookmarks') THEN
    DELETE FROM bookmarks WHERE reference_id IN (SELECT r.id FROM "references" r WHERE r.saved_by = target_user_id) OR created_by = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'references') THEN
    DELETE FROM "references" WHERE saved_by = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_members') THEN
    DELETE FROM project_members WHERE project_id IN (SELECT p.id FROM projects p WHERE p.owner_id = target_user_id) OR user_id = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_invitations') THEN
    DELETE FROM project_invitations WHERE project_id IN (SELECT p.id FROM projects p WHERE p.owner_id = target_user_id)
      OR invitee_email = target_email OR inviter_id = target_user_id OR invitee_id = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    DELETE FROM projects p WHERE p.owner_id = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'citation_settings') THEN
    DELETE FROM citation_settings WHERE user_id = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    DELETE FROM settings WHERE user_id = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'browsing_history_candidates') THEN
    DELETE FROM browsing_history_candidates WHERE user_id = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_requests') THEN
    DELETE FROM feature_requests WHERE user_id = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
    DELETE FROM activity_logs WHERE user_id = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tags') THEN
    DELETE FROM tags WHERE created_by = target_user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DELETE FROM profiles WHERE id = target_user_id;
  END IF;

  ----------------------------------------------------------------------------
  -- プロファイルと設定
  ----------------------------------------------------------------------------
  INSERT INTO profiles (id, email, name, is_admin, created_at, updated_at)
  VALUES (target_user_id, lower(target_email), 'Coder Demo', true, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email,
        is_admin = EXCLUDED.is_admin,
        updated_at = now();

  IF collaborator_id <> target_user_id THEN
    INSERT INTO profiles (id, email, name, is_admin, created_at, updated_at)
    VALUES (collaborator_id, 'hayashi.researcher@example.com', '林 悠斗', false, now(), now())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, updated_at = now();
  END IF;

  IF reviewer_id <> target_user_id THEN
    INSERT INTO profiles (id, email, name, is_admin, created_at, updated_at)
    VALUES (reviewer_id, 'sato.designer@example.com', '佐藤 彩', false, now(), now())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, updated_at = now();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    INSERT INTO settings (user_id, dashboard_layout)
    VALUES (target_user_id, 'grid')
    ON CONFLICT (user_id) DO UPDATE SET dashboard_layout = EXCLUDED.dashboard_layout;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'citation_settings') THEN
    INSERT INTO citation_settings (user_id, default_style)
    VALUES (target_user_id, 'APA')
    ON CONFLICT (user_id) DO UPDATE SET default_style = EXCLUDED.default_style;
  END IF;

  ----------------------------------------------------------------------------
  -- プロジェクト
  ----------------------------------------------------------------------------
  INSERT INTO projects (id, name, description, color, icon, is_public, is_link_sharing_enabled, link_sharing_token, owner_id, created_at, updated_at)
  VALUES (gen_random_uuid(), 'AI 安全性レビュー', 'LLMガイドラインと安全対策の収集ノート', '#2563EB', '🧠', false, true, gen_random_uuid(), target_user_id, now() - interval '21 days', now() - interval '2 days')
  RETURNING id INTO p_ai;

  INSERT INTO projects (id, name, description, color, icon, is_public, is_link_sharing_enabled, link_sharing_token, owner_id, created_at, updated_at)
  VALUES (gen_random_uuid(), '気候レポート 2025', '政策提言用の気候変動エビデンスまとめ', '#16A34A', '🌿', true, false, gen_random_uuid(), target_user_id, now() - interval '14 days', now() - interval '1 day')
  RETURNING id INTO p_climate;

  INSERT INTO projects (id, name, description, color, icon, is_public, is_link_sharing_enabled, link_sharing_token, owner_id, created_at, updated_at)
  VALUES (gen_random_uuid(), '研究ワークフロー改善', 'リサーチワークフローとツール検証ログ', '#F97316', '🧪', false, false, gen_random_uuid(), target_user_id, now() - interval '10 days', now() - interval '3 hours')
  RETURNING id INTO p_methods;

  INSERT INTO project_members (project_id, user_id, role, joined_at)
  VALUES
    (p_ai, target_user_id, 'admin', now() - interval '21 days'),
    (p_climate, target_user_id, 'admin', now() - interval '14 days'),
    (p_methods, target_user_id, 'admin', now() - interval '10 days')
    ON CONFLICT DO NOTHING;

  IF collaborator_id <> target_user_id THEN
    INSERT INTO project_members (project_id, user_id, role, joined_at)
    VALUES (p_ai, collaborator_id, 'editor', now() - interval '6 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF reviewer_id <> target_user_id THEN
    INSERT INTO project_members (project_id, user_id, role, joined_at)
    VALUES (p_climate, reviewer_id, 'viewer', now() - interval '4 days')
    ON CONFLICT DO NOTHING;
  END IF;

  ----------------------------------------------------------------------------
  -- タグ
  ----------------------------------------------------------------------------
  INSERT INTO tags (id, name, color, created_by, created_at)
  VALUES (gen_random_uuid(), 'LLM安全', '#6366F1', target_user_id, now() - interval '20 days')
  RETURNING id INTO tag_ai;

  INSERT INTO tags (id, name, color, created_by, created_at)
  VALUES (gen_random_uuid(), '政策', '#F59E0B', target_user_id, now() - interval '13 days')
  RETURNING id INTO tag_policy;

  INSERT INTO tags (id, name, color, created_by, created_at)
  VALUES (gen_random_uuid(), '気候科学', '#0EA5E9', target_user_id, now() - interval '12 days')
  RETURNING id INTO tag_climate;

  INSERT INTO tags (id, name, color, created_by, created_at)
  VALUES (gen_random_uuid(), 'ワークフロー', '#10B981', target_user_id, now() - interval '9 days')
  RETURNING id INTO tag_methods;

  ----------------------------------------------------------------------------
  -- 参照（プロジェクト別）
  ----------------------------------------------------------------------------
  INSERT INTO "references" (
    id, title, url, memo, authors, published_date, accessed_date,
    project_id, reference_type, publisher, pages, doi, journal_name,
    volume, issue, edition, saved_at, updated_at, saved_by, favicon, metadata
  )
  VALUES (
    gen_random_uuid(),
    'Trust Layers for LLM Agents',
    'https://example.org/papers/trust-layers-llm',
    '安全性レビューのベースラインとして引用。リスク分類が明瞭で UI 文言検討に使える。',
    '[{"name":"Morgan Lee","order":1},{"name":"Priya Raman","order":2}]'::jsonb,
    (now() - interval '32 days')::date,
    (now() - interval '2 days')::date,
    p_ai,
    'article',
    'Journal of Synthetic Intelligence',
    '22-34',
    '10.1234/jsi.2025.014',
    'Journal of Synthetic Intelligence',
    '12',
    '1',
    null,
    now() - interval '2 days',
    now() - interval '2 days',
    target_user_id,
    'https://example.org/assets/jsi-favicon.png',
    jsonb_build_object(
      'description', 'マルチエージェント構成における信頼境界の設計指針と評価ベンチマーク。',
      'siteName', 'Example Journal',
      'tags', array['trust', 'guardrails', 'benchmark']
    )
  )
  RETURNING id INTO ref_guardrails;

  INSERT INTO "references" (
    id, title, url, memo, authors, published_date, accessed_date,
    project_id, reference_type, publisher, pages, doi, journal_name,
    volume, issue, edition, saved_at, updated_at, saved_by, favicon, metadata
  )
  VALUES (
    gen_random_uuid(),
    'Evaluation Cookbook for Safety Benchmarks',
    'https://ai.example.com/blog/eval-cookbook',
    '内部ワークショップ用。指標テンプレをダッシュボードに転記予定。',
    '[{"name":"Lena Duarte","order":1}]'::jsonb,
    (now() - interval '18 days')::date,
    (now() - interval '1 day')::date,
    p_ai,
    'report',
    'AI Security Lab',
    '48',
    null,
    null,
    null,
    null,
    null,
    now() - interval '1 day',
    now() - interval '1 day',
    target_user_id,
    'https://ai.example.com/favicon.ico',
    jsonb_build_object(
      'description', 'モデルカードに差し込める評価項目サンプルと失敗例のカタログ。',
      'siteName', 'AI Security Lab',
      'tags', array['evaluation', 'red-teaming']
    )
  )
  RETURNING id INTO ref_eval;

  INSERT INTO "references" (
    id, title, url, memo, authors, published_date, accessed_date,
    project_id, reference_type, publisher, pages, doi, journal_name,
    volume, issue, edition, saved_at, updated_at, saved_by, favicon, metadata
  )
  VALUES (
    gen_random_uuid(),
    'Urban Heat Islands: 2025 Outlook',
    'https://climate.example.net/reports/uhi-2025',
    '政策ページ用の根拠。図表 3 を引用予定。',
    '[{"name":"Amina Farouk","order":1},{"name":"Julien Moreau","order":2}]'::jsonb,
    (now() - interval '45 days')::date,
    (now() - interval '5 days')::date,
    p_climate,
    'report',
    'Global Climate Forum',
    '112',
    '10.5678/gcf.2025.uhi',
    'Global Climate Forum Reports',
    '2025',
    null,
    null,
    now() - interval '5 days',
    now() - interval '5 days',
    target_user_id,
    'https://climate.example.net/assets/favicon.png',
    jsonb_build_object(
      'description', '都市ヒートアイランドの将来予測と緩和策。都市設計セクションが秀逸。',
      'siteName', 'Global Climate Forum',
      'tags', array['UHI', 'policy', 'mitigation']
    )
  )
  RETURNING id INTO ref_green;

  INSERT INTO "references" (
    id, title, url, memo, authors, published_date, accessed_date,
    project_id, reference_type, publisher, pages, doi, journal_name,
    volume, issue, edition, saved_at, updated_at, saved_by, favicon, metadata
  )
  VALUES (
    gen_random_uuid(),
    'Telehealth Adoption in Rural Clinics',
    'https://health.example.com/articles/telehealth-rural',
    '医療系の参照。エビデンス比較表を引用。',
    '[{"name":"Kara Singh","order":1},{"name":"Liang Chen","order":2}]'::jsonb,
    (now() - interval '27 days')::date,
    (now() - interval '3 days')::date,
    p_climate,
    'journal',
    'Health Systems Today',
    '67-81',
    '10.9988/hst.2025.332',
    'Health Systems Today',
    '19',
    '2',
    null,
    now() - interval '3 days',
    now() - interval '3 days',
    target_user_id,
    'https://health.example.com/favicon.ico',
    jsonb_build_object(
      'description', '遠隔医療導入のコストと効果を定量比較。地域医療の事例が豊富。',
      'siteName', 'Health Systems Today',
      'tags', array['health', 'telemedicine', 'policy']
    )
  )
  RETURNING id INTO ref_health;

  INSERT INTO "references" (
    id, title, url, memo, authors, published_date, accessed_date,
    project_id, reference_type, publisher, pages, doi, journal_name,
    volume, issue, edition, saved_at, updated_at, saved_by, favicon, metadata
  )
  VALUES (
    gen_random_uuid(),
    'Prompt Library for Evidence Gathering',
    'https://workflow.example.org/prompts/evidence',
    '拡張機能で使うプロンプトを整理。社内ナレッジにも掲載予定。',
    '[{"name":"Noah Alvarez","order":1}]'::jsonb,
    (now() - interval '9 days')::date,
    (now() - interval '9 hours')::date,
    p_methods,
    'website',
    'Workflow Studio',
    null,
    null,
    null,
    null,
    null,
    null,
    now() - interval '9 hours',
    now() - interval '9 hours',
    target_user_id,
    'https://workflow.example.org/favicon.png',
    jsonb_build_object(
      'description', 'エビデンス収集向けのプロンプトスニペット集。タスク別に分類。',
      'siteName', 'Workflow Studio',
      'tags', array['prompt', 'templates']
    )
  )
  RETURNING id INTO ref_prompt;

  INSERT INTO "references" (
    id, title, url, memo, authors, published_date, accessed_date,
    project_id, reference_type, publisher, pages, doi, journal_name,
    volume, issue, edition, saved_at, updated_at, saved_by, favicon, metadata
  )
  VALUES (
    gen_random_uuid(),
    'Extension UX Notes (Beta)',
    'https://researchvault.example.app/notes/extension-beta',
    '拡張機能の UI メモ。スクリーンショット整理用に保存。',
    null,
    null,
    (now() - interval '1 hour')::date,
    p_methods,
    'website',
    'Internal Notebook',
    null,
    null,
    null,
    null,
    null,
    null,
    now() - interval '1 hour',
    now() - interval '30 minutes',
    target_user_id,
    'https://researchvault.example.app/favicon.ico',
    jsonb_build_object(
      'description', 'モックアップ撮影用のダミーノート。拡張ポップアップの動線を記録。',
      'siteName', 'ResearchVault Notes',
      'tags', array['extension', 'ux', 'capture']
    )
  )
  RETURNING id INTO ref_extension;

  ----------------------------------------------------------------------------
  -- 参照タグ付け
  ----------------------------------------------------------------------------
  INSERT INTO reference_tags (reference_id, tag_id)
  VALUES
    (ref_guardrails, tag_ai),
    (ref_eval, tag_ai),
    (ref_eval, tag_methods),
    (ref_green, tag_climate),
    (ref_green, tag_policy),
    (ref_health, tag_policy),
    (ref_prompt, tag_methods),
    (ref_extension, tag_methods);

  ----------------------------------------------------------------------------
  -- 選択テキスト（ハイライト）
  ----------------------------------------------------------------------------
  INSERT INTO selected_texts (
    reference_id, text, xpath, context_before, context_after,
    pdf_page, pdf_position, created_by, created_at
  ) VALUES
    (
      ref_guardrails,
      'We introduce a layered trust model separating capability from decision policy, reducing high-severity incidents by 42% in simulations.',
      '/html/body/div[1]/section[2]/p[3]',
      'In this study,',
      'across multi-agent rollouts.',
      3,
      '{"x":0.42,"y":0.61,"width":0.3,"height":0.08}'::jsonb,
      target_user_id,
      now() - interval '2 days'
    ),
    (
      ref_green,
      'Cooling demand will exceed mitigation capacity in 38% of dense Asian cities by 2030 without reflective zoning.',
      '/html/body/main/article/section[4]/p[2]',
      'Our projections show that',
      'especially under RCP6.0.',
      5,
      '{"x":0.18,"y":0.44,"width":0.65,"height":0.07}'::jsonb,
      target_user_id,
      now() - interval '5 days'
    ),
    (
      ref_prompt,
      'Gather three peer-reviewed references published after 2022, then summarize policy implications in 120 Japanese characters.',
      null,
      null,
      null,
      null,
      null,
      target_user_id,
      now() - interval '9 hours'
    ),
    (
      ref_extension,
      'Popup keeps last project/format selection to speed up captures during interviews.',
      null,
      null,
      null,
      null,
      null,
      target_user_id,
      now() - interval '30 minutes'
    );

  ----------------------------------------------------------------------------
  -- 記録漏れ候補（拡張/ダッシュボード用）: main.sql スキーマに合わせる（domain/last_visitなし）
  ----------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'browsing_history_candidates') THEN
    INSERT INTO browsing_history_candidates (
      url, title, favicon, visited_at, user_id,
      is_academic, confidence_score, suggested_reason, visit_count,
      subject, subject_confidence, ai_classified, classification_result, dismissed,
      category
    ) VALUES
      (
        'https://arxiv.org/abs/2501.01234',
        'Robust Reward Models for Open-Ended Agents',
        'https://arxiv.org/favicon.ico',
        now() - interval '6 hours',
        target_user_id,
        true,
        0.92,
        '学術的なウェブサイト',
        4,
        null,
        null,
        true,
        '{"category":"ai-safety","notes":"uses human-in-the-loop evals"}',
        false,
        'AI安全'
      ),
      (
        'https://scholar.google.com/scholar?hl=ja&q=urban+heat+islands',
        'Urban Heat Island mitigation search',
        'https://scholar.google.com/favicon.ico',
        now() - interval '1 day',
        target_user_id,
        true,
        0.77,
        '学術検索サイトへのアクセス',
        2,
        null,
        null,
        true,
        '{"category":"climate","notes":"policy queries"}',
        false,
        '気候科学'
      ),
      (
        'https://nature.com/articles/telehealth-rural-2025',
        'Scaling telehealth in rural regions',
        'https://nature.com/favicon.ico',
        now() - interval '3 days',
        target_user_id,
        true,
        0.64,
        'Nature誌の研究論文',
        1,
        null,
        null,
        false,
        null,
        false,
        'ヘルスケア'
      ),
      (
        'https://workflowy.example.com/boards/research-prompt-library',
        'Prompt Library board',
        'https://workflowy.example.com/favicon.ico',
        now() - interval '12 hours',
        target_user_id,
        false,
        0.48,
        '研究に関連する可能性があるサイト',
        5,
        null,
        null,
        true,
        '{"category":"workflow","notes":"prompt catalog"}',
        false,
        'ワークフロー'
      ),
      (
        'https://journals.example.org/policy/heat-adaptation',
        'Policy instruments for heat adaptation',
        'https://journals.example.org/favicon.ico',
        now() - interval '4 days',
        target_user_id,
        true,
        0.58,
        '学術的なウェブサイト',
        2,
        null,
        null,
        false,
        null,
        false,
        '政策'
      );
  END IF;

  ----------------------------------------------------------------------------
  -- 機能リクエスト（機能リクエストページ用）
  ----------------------------------------------------------------------------
  INSERT INTO feature_requests (user_id, title, type, description, created_at, updated_at, deleted_at)
  VALUES
    (
      target_user_id,
      'プロジェクト単位のテンプレート色設定',
      'feature',
      'プロジェクト作成時に「配色プリセット」を選べるようにしたい。共有リンクの背景も合わせて変化してほしい。',
      now() - interval '5 days',
      now() - interval '1 day',
      null
    ),
    (
      collaborator_id,
      'PDF ハイライトの一括エクスポート',
      'improvement',
      'selected_texts に溜めたハイライトをプロジェクトごとに Markdown で出力したい。ページ番号と位置情報付きで。',
      now() - interval '3 days',
      now() - interval '3 days',
      null
    ),
    (
      target_user_id,
      'タグの自動候補（LLM 補助）',
      'feature',
      '保存時に URL と本文からタグ候補を 3 つ提示するオプションが欲しい。誤爆を避けるためプライベートのみで良い。',
      now() - interval '12 hours',
      now() - interval '12 hours',
      null
    );
END $$;


