// Supabase Edge Function: send-invitation-email
// 環境変数:
//   RESEND_API_KEY: ResendのAPIキー（必須）
//   MAIL_FROM: 送信元メールアドレス（例: "ResearchVault <no-reply@yourdomain.com>"）
//
// 備考:
// - Resendを利用してメール送信します。APIキーとMAIL_FROMを必ず設定してください。
// - CORSを許容し、エラー時もJSONで返します。

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.0";

const escapeHtml = (value: string) => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

type InvitationPayload = {
  invitationId: string;
  projectId: string;
  projectName: string;
  projectDescription?: string;
  projectColor?: string;
  projectIcon?: string;
  inviterName: string;
  inviteeEmail: string;
  role: "viewer" | "editor";
  message?: string | null;
  siteUrl: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const input = await req.json();
    const { data: invitation, error: invitationError } = await client.from("project_invitations")
      .select("id,project_id,inviter_id,invitee_id,invitee_email,role,message,status,email_sent_at")
      .eq("id", input.invitationId).eq("inviter_id", user.id).single();
    if (invitationError || !invitation || invitation.status !== "accepted") {
      return new Response(JSON.stringify({ error: "Invitation permission required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { data: project } = await client.from("projects").select("id,name,description,owner_id")
      .eq("id", invitation.project_id).is("deleted_at", null).single();
    const { data: membership } = await client.from("project_members").select("role")
      .eq("project_id", invitation.project_id).eq("user_id", user.id).maybeSingle();
    if (!project || (project.owner_id !== user.id && membership?.role !== "admin")) {
      return new Response(JSON.stringify({ error: "Project management permission required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (invitation.email_sent_at) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { data: invitees, error: recipientError } = await client.rpc("find_project_invitee", {
      p_project_id: invitation.project_id, p_email: invitation.invitee_email
    });
    if (recipientError || !invitees?.some(person => person.id === invitation.invitee_id)) {
      return new Response(JSON.stringify({ error: "Invitation recipient mismatch" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { data: profile } = await client.from("profiles").select("name").eq("id", user.id).single();
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const mailFrom = Deno.env.get("MAIL_FROM");

    if (!apiKey || !mailFrom) {
      return new Response(
        JSON.stringify({ error: "Missing RESEND_API_KEY or MAIL_FROM" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: InvitationPayload = {
      invitationId: invitation.id, projectId: project.id,
      projectName: project.name, projectDescription: project.description,
      inviterName: profile?.name || "ユーザー", inviteeEmail: invitation.invitee_email,
      role: invitation.role, message: invitation.message,
      siteUrl: "https://rv.insas.jp"
    };
    const {
      projectName,
      projectDescription,
      inviterName,
      inviteeEmail,
      role,
      message,
      siteUrl,
    } = payload;

    const roleLabel = role === "editor" ? "編集者" : "閲覧者";
    const projectUrl = `${siteUrl}/projects/${payload.projectId}`;

    const html = `
      <div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color: #1f2937;">
        <h2 style="color:#111827;">プロジェクトに招待されました</h2>
        <p><strong>${escapeHtml(inviterName)}</strong> さんがあなたを以下のプロジェクトに招待しました。</p>
        <div style="padding:12px 14px; border:1px solid #e5e7eb; border-radius:8px; background:#f9fafb; margin:12px 0;">
          <div style="font-size:15px; font-weight:600;">${escapeHtml(projectName)}</div>
          <div style="font-size:13px; color:#4b5563; margin-top:4px;">${escapeHtml(projectDescription || "プロジェクトの説明はありません")}</div>
          <div style="margin-top:8px; font-size:13px;">
            <strong>付与される権限:</strong>
            <span style="background:#e0f2fe; color:#1d4ed8; padding:2px 8px; border-radius:12px; margin-left:6px;">${roleLabel}</span>
          </div>
        </div>
        ${
          message
            ? `<div style="padding:10px 12px; border-left:4px solid #fbbf24; background:#fffbeb; border-radius:6px; margin:12px 0;">
                <div style="font-weight:600; color:#92400e;">${escapeHtml(inviterName)} さんからのメッセージ:</div>
                <div style="color:#92400e; margin-top:4px;">${escapeHtml(message)}</div>
              </div>`
            : ""
        }
        <p style="margin-top:16px;">以下のボタンからプロジェクトを開けます。</p>
        <div style="margin:16px 0;">
          <a href="${projectUrl}" style="display:inline-block; background:#2563eb; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600;">プロジェクトを開く</a>
        </div>
        <div style="font-size:12px; color:#6b7280;">リンクが開けない場合: ${projectUrl}</div>
      </div>
    `;

    const text = `
プロジェクトに招待されました
${inviterName} さんがあなたを招待しました。

プロジェクト名: ${projectName}
説明: ${projectDescription || "なし"}
付与権限: ${roleLabel}
${message ? `メッセージ: ${message}` : ""}

プロジェクトを開く: ${projectUrl}
`.trim();

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `invitation/${invitation.id}`,
      },
      body: JSON.stringify({
        from: mailFrom,
        to: [inviteeEmail],
        subject: `[ResearchVault] ${inviterName}さんからの招待`,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await client.from("project_invitations").update({ email_sent_at: new Date().toISOString() })
      .eq("id", invitation.id);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-invitation-email error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

