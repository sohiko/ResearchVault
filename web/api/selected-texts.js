import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'GET') {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: '認証が必要です' });
            }

            const token = authHeader.split(' ')[1];
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);

            if (authError || !user) {
                return res.status(401).json({ error: '無効な認証トークンです' });
            }

            const { sortOrder = 'desc' } = req.query;

            const { data: selectedTexts, error } = await supabase
                .from('selected_texts')
                .select(`
                    *,
                    references:reference_id (
                        id,
                        url,
                        title,
                        favicon
                    )
                `)
                .eq('created_by', user.id)
                .order('created_at', { ascending: sortOrder === 'asc' });

            if (error) {throw error;}

            const grouped = {};
            selectedTexts.forEach(item => {
                const ref = item.references;
                if (!ref) {return;}

                const url = ref.url;
                if (!grouped[url]) {
                    grouped[url] = {
                        url: ref.url,
                        title: ref.title,
                        favicon: ref.favicon,
                        texts: [],
                        latestDate: item.created_at
                    };
                }
                grouped[url].texts.push(item);
                if (item.created_at > grouped[url].latestDate) {
                    grouped[url].latestDate = item.created_at;
                }
            });

            const result = Object.values(grouped).sort((a, b) => {
                if (sortOrder === 'asc') {
                    return new Date(a.latestDate) - new Date(b.latestDate);
                }
                return new Date(b.latestDate) - new Date(a.latestDate);
            });

            res.status(200).json(result);
        } catch (error) {
            console.error('Error fetching selected texts:', error);
            res.status(500).json({ error: 'サーバーエラーが発生しました' });
        }
    } else if (req.method === 'DELETE') {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: '認証が必要です' });
            }

            const token = authHeader.split(' ')[1];
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);

            if (authError || !user) {
                return res.status(401).json({ error: '無効な認証トークンです' });
            }

            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ error: 'IDが必要です' });
            }

            const { error } = await supabase
                .from('selected_texts')
                .delete()
                .eq('id', id)
                .eq('created_by', user.id);

            if (error) {throw error;}

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error deleting selected text:', error);
            res.status(500).json({ error: 'サーバーエラーが発生しました' });
        }
    } else if (req.method === 'POST') {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: '認証が必要です' });
            }

            const token = authHeader.split(' ')[1];
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);

            if (authError || !user) {
                return res.status(401).json({ error: '無効な認証トークンです' });
            }

            const { textId, projectId } = req.body;

            if (!textId || !projectId) {
                return res.status(400).json({ error: 'テキストIDとプロジェクトIDが必要です' });
            }

            const { data: selectedText, error: fetchError } = await supabase
                .from('selected_texts')
                .select('*, references:reference_id(url, title, favicon, metadata)')
                .eq('id', textId)
                .eq('created_by', user.id)
                .single();

            if (fetchError || !selectedText) {
                return res.status(404).json({ error: '選択テキストが見つかりません' });
            }

            const ref = selectedText.references;
            
            const { data: existingRef } = await supabase
                .from('references')
                .select('id')
                .eq('url', ref.url)
                .eq('project_id', projectId)
                .maybeSingle();

            let referenceId;

            if (existingRef) {
                referenceId = existingRef.id;
            } else {
                const { data: newRef, error: refError } = await supabase
                    .from('references')
                    .insert({
                        project_id: projectId,
                        url: ref.url,
                        title: ref.title,
                        favicon: ref.favicon,
                        saved_by: user.id,
                        metadata: ref.metadata || {}
                    })
                    .select()
                    .single();

                if (refError) {throw refError;}
                referenceId = newRef.id;
            }

            const { error: updateError } = await supabase
                .from('selected_texts')
                .update({
                    project_id: projectId,
                    reference_id: referenceId
                })
                .eq('id', textId);

            if (updateError) {throw updateError;}

            res.status(200).json({ success: true, referenceId });
        } catch (error) {
            console.error('Error saving to project:', error);
            res.status(500).json({ error: 'サーバーエラーが発生しました' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}

