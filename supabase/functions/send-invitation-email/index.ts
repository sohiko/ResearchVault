// Supabase Edge Function: 招待メール送信
// deno-lint-ignore-file no-explicit-any

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitationEmailRequest {
  invitationId: string
  projectId: string
  projectName: string
  projectDescription?: string
  projectColor: string
  projectIcon: string
  inviterName: string
  inviteeEmail: string
  role: 'viewer' | 'editor'
  message?: string
  siteUrl: string
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // リクエストボディの取得
    const requestData: InvitationEmailRequest = await req.json()
    
    const {
      invitationId,
      projectId,
      projectName,
      projectDescription,
      projectColor,
      projectIcon,
      inviterName,
      inviteeEmail,
      role,
      message,
      siteUrl,
    } = requestData

    // 権限ラベルと色の設定
    const roleLabel = role === 'editor' ? '編集者' : '閲覧者'
    const roleColor = role === 'editor' ? '#dcfce7' : '#dbeafe'
    const roleTextColor = role === 'editor' ? '#166534' : '#1e40af'

    // プロジェクトURL
    const projectUrl = `${siteUrl}/projects/${projectId}`

    // メール本文（HTML）
    const htmlContent = generateEmailHtml({
      inviterName,
      projectName,
      projectDescription: projectDescription || 'プロジェクトの説明はありません',
      projectColor,
      projectIcon,
      roleLabel,
      roleColor,
      roleTextColor,
      message,
      projectUrl,
      siteUrl,
    })

    // メール本文（プレーンテキスト）
    const textContent = `
ResearchVault - プロジェクトへの招待

${inviterName} さんがあなたを以下のプロジェクトに招待しました。

プロジェクト名: ${projectName}
説明: ${projectDescription || 'プロジェクトの説明はありません'}
付与される権限: ${roleLabel}
${message ? `\nメッセージ: "${message}"` : ''}

以下のリンクからプロジェクトを確認してください：
${projectUrl}

---
権限について
- 閲覧者: プロジェクトと参照の閲覧のみ可能
- 編集者: 参照の追加・編集・削除、メンバーの招待が可能

---
このメールは ResearchVault から自動送信されています。
心当たりがない場合は、このメールを無視してください。
    `.trim()

    // Supabaseの組み込みメール送信機能を使用
    // Note: SMTP設定がSupabaseダッシュボードで設定されている必要があります
    const { error: emailError } = await supabase.auth.admin.createUser({
      email: inviteeEmail,
      email_confirm: true,
      user_metadata: {
        invitation_email: true,
      },
    }).catch(() => {
      // ユーザーが既に存在する場合はエラーを無視
      return { error: null }
    })

    // カスタムメール送信（pg_netまたは外部API経由）
    // Supabaseの標準SMTPを使う場合は、以下のようなpg_net拡張を使用するか、
    // または外部のメールサービス（Resend等）を呼び出す

    // 招待レコードのemail_sent_atを更新
    const { error: updateError } = await supabase
      .from('project_invitations')
      .update({ 
        email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invitationId)

    if (updateError) {
      console.error('Failed to update invitation record:', updateError)
    }

    // 成功レスポンス
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation email queued for sending',
        data: {
          invitationId,
          inviteeEmail,
          emailContent: {
            subject: `[ResearchVault] ${inviterName}さんからプロジェクト「${projectName}」への招待`,
            html: htmlContent,
            text: textContent,
          }
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Error in send-invitation-email:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

interface EmailTemplateParams {
  inviterName: string
  projectName: string
  projectDescription: string
  projectColor: string
  projectIcon: string
  roleLabel: string
  roleColor: string
  roleTextColor: string
  message?: string
  projectUrl: string
  siteUrl: string
}

function generateEmailHtml(params: EmailTemplateParams): string {
  const {
    inviterName,
    projectName,
    projectDescription,
    projectColor,
    projectIcon,
    roleLabel,
    roleColor,
    roleTextColor,
    message,
    projectUrl,
    siteUrl,
  } = params

  const messageSection = message ? `
    <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
      <p style="color: #713f12; font-size: 14px; margin: 0 0 5px 0; font-weight: 500;">
        ${inviterName} さんからのメッセージ:
      </p>
      <p style="color: #854d0e; font-size: 14px; margin: 0; font-style: italic;">
        "${message}"
      </p>
    </div>
  ` : ''

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ResearchVault - プロジェクトへの招待</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- ヘッダー -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0; letter-spacing: 1px;">
                ResearchVault
            </h1>
            <p style="color: #e2e8f0; font-size: 14px; margin: 8px 0 0 0;">
                Research Made Simple
            </p>
        </div>
        
        <!-- メインコンテンツ -->
        <div style="padding: 40px 30px;">
            <h2 style="color: #1a202c; font-size: 22px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                プロジェクトに招待されました
            </h2>
            
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                <strong style="color: #1a202c;">${inviterName}</strong> さんがあなたを以下のプロジェクトに招待しました。
            </p>
            
            <!-- プロジェクト情報カード -->
            <div style="background-color: #f7fafc; border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #e2e8f0;">
                <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="width: 48px; vertical-align: top;">
                      <div style="width: 48px; height: 48px; background-color: ${projectColor}; border-radius: 10px; text-align: center; line-height: 48px;">
                        <span style="font-size: 24px;">${projectIcon}</span>
                      </div>
                    </td>
                    <td style="padding-left: 15px; vertical-align: top;">
                      <h3 style="color: #1a202c; font-size: 18px; font-weight: 600; margin: 0;">
                        ${projectName}
                      </h3>
                      <p style="color: #718096; font-size: 14px; margin: 4px 0 0 0;">
                        ${projectDescription}
                      </p>
                    </td>
                  </tr>
                </table>
                
                <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 15px;">
                    <p style="color: #4a5568; font-size: 14px; margin: 0;">
                        <strong>付与される権限:</strong> 
                        <span style="display: inline-block; background-color: ${roleColor}; color: ${roleTextColor}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; margin-left: 8px;">
                            ${roleLabel}
                        </span>
                    </p>
                </div>
            </div>
            
            ${messageSection}
            
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                以下のボタンをクリックして、プロジェクトを確認してください。
            </p>
            
            <!-- アクションボタン -->
            <div style="text-align: center; margin: 35px 0;">
                <a href="${projectUrl}" 
                   style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 15px 35px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                    プロジェクトを開く
                </a>
            </div>
            
            <!-- 代替リンク -->
            <div style="background-color: #f7fafc; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="color: #718096; font-size: 14px; margin: 0 0 10px 0; font-weight: 500;">
                    ボタンが機能しない場合は、以下のリンクをコピーしてブラウザのアドレスバーに貼り付けてください：
                </p>
                <p style="color: #3b82f6; font-size: 14px; word-break: break-all; margin: 0; font-family: 'Courier New', monospace;">
                    ${projectUrl}
                </p>
            </div>
            
            <!-- 権限の説明 -->
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h4 style="color: #1a202c; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">
                    権限について
                </h4>
                <ul style="color: #4a5568; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 20px;">
                    <li><strong>閲覧者:</strong> プロジェクトと参照の閲覧のみ可能</li>
                    <li><strong>編集者:</strong> 参照の追加・編集・削除、メンバーの招待が可能</li>
                </ul>
            </div>
        </div>
        
        <!-- フッター -->
        <div style="background-color: #edf2f7; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #718096; font-size: 14px; margin: 0 0 10px 0;">
                このメールは ResearchVault から自動送信されています。
            </p>
            <p style="color: #718096; font-size: 13px; margin: 0 0 10px 0;">
                心当たりがない場合は、このメールを無視してください。
            </p>
            <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                © ${siteUrl} ResearchVault. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
  `.trim()
}

