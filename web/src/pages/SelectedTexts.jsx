import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import toast from 'react-hot-toast';

// Text Fragments APIの互換性チェック
const supportsTextFragments = () => {
    return /Chrome|Chromium|Edge/.test(navigator.userAgent);
};

export default function SelectedTexts() {
    const { user, session } = useAuth();
    const { projects } = useProjects();
    const [groupedTexts, setGroupedTexts] = useState([]);
    const [sortOrder, setSortOrder] = useState('desc');
    const [loading, setLoading] = useState(true);
    const [expandedUrls, setExpandedUrls] = useState(new Set());
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [selectedTextId, setSelectedTextId] = useState(null);
    const [browserSupportsFragments] = useState(supportsTextFragments());

    const loadSelectedTexts = useCallback(async () => {
        if (!session?.access_token) {return;}

        try {
            setLoading(true);
            
            // Supabase APIを直接使用
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

            setGroupedTexts(result);
        } catch (error) {
            console.error('Error loading selected texts:', error);
        } finally {
            setLoading(false);
        }
    }, [session, user, sortOrder]);

    useEffect(() => {
        loadSelectedTexts();
    }, [loadSelectedTexts]);

    async function handleDelete(textId) {
        // eslint-disable-next-line no-alert
        const confirmed = window.confirm('この選択テキストを削除しますか？');
        if (!confirmed) {
            return;
        }

        try {
            const { error } = await supabase
                .from('selected_texts')
                .delete()
                .eq('id', textId)
                .eq('created_by', user.id);

            if (error) {
                throw error;
            }

            toast.success('削除しました');
            loadSelectedTexts();
        } catch (error) {
            console.error('Error deleting text:', error);
            toast.error('削除に失敗しました');
        }
    }

    async function handleSaveToProject(projectId) {
        try {
            // 選択されたテキストを取得
            const { data: selectedText, error: fetchError } = await supabase
                .from('selected_texts')
                .select('*, references:reference_id(url, title, favicon, metadata)')
                .eq('id', selectedTextId)
                .eq('created_by', user.id)
                .single();

            if (fetchError || !selectedText) {
                throw new Error('選択テキストが見つかりません');
            }

            const ref = selectedText.references;
            
            // 既存の参照を確認
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
                // 新しい参照を作成
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

            // selected_textsを更新
            const { error: updateError } = await supabase
                .from('selected_texts')
                .update({
                    project_id: projectId,
                    reference_id: referenceId
                })
                .eq('id', selectedTextId);

            if (updateError) {
                throw updateError;
            }

            setShowProjectModal(false);
            setSelectedTextId(null);
            toast.success('プロジェクトに保存しました');
        } catch (error) {
            console.error('Error saving to project:', error);
            toast.error('保存に失敗しました: ' + error.message);
        }
    }

    function toggleExpand(url) {
        const newExpanded = new Set(expandedUrls);
        if (newExpanded.has(url)) {
            newExpanded.delete(url);
        } else {
            newExpanded.add(url);
        }
        setExpandedUrls(newExpanded);
    }

    function handleTextClick(text) {
        // Text Fragments APIを使用してURLを生成
        const fragmentUrl = generateTextFragmentUrl(text);
        
        // aタグを使ってURLを開く（ブラウザのエンコードを防ぐ）
        const link = document.createElement('a');
        link.href = fragmentUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function generateTextFragmentUrl(text) {
        const { references, text: selectedText, context_before, context_after } = text;
        const baseUrl = references.url;
        
        // Text Fragmentの構築（エンコードせずに日本語のまま）
        let fragment = '#:~:text=';
        
        // 前後のコンテキストがあれば追加（精度向上）
        if (context_before && context_before.trim()) {
            const prefix = context_before.trim().slice(-50); // 最後の50文字
            fragment += prefix + '-,';
        }
        
        // メインテキスト（日本語のまま）
        fragment += selectedText;
        
        // 後のコンテキスト
        if (context_after && context_after.trim()) {
            const suffix = context_after.trim().slice(0, 50); // 最初の50文字
            fragment += ',-' + suffix;
        }
        
        return baseUrl + fragment;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-secondary-900">保存済みテキスト</h1>
                <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="px-4 py-2 border border-secondary-300 rounded-md bg-white text-secondary-900"
                >
                    <option value="desc">最新順</option>
                    <option value="asc">古い順</option>
                </select>
            </div>

            {!browserSupportsFragments && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                        ⚠️ お使いのブラウザではテキストハイライト機能が制限されます。
                        Chrome、Edge、Operaでの利用を推奨します。
                    </p>
                </div>
            )}

            {groupedTexts.length === 0 ? (
                <div className="text-center py-12 text-secondary-600">
                    保存済みのテキストがありません
                </div>
            ) : (
                <div className="space-y-4">
                    {groupedTexts.map((group) => (
                        <div key={group.url} className="bg-white border border-secondary-200 rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleExpand(group.url)}
                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {group.favicon && (
                                        <img src={group.favicon} alt="" className="w-5 h-5" />
                                    )}
                                    <div className="text-left">
                                        <div className="font-medium text-secondary-900">{group.title || group.url}</div>
                                        <div className="text-sm text-secondary-500">{group.texts.length}件のテキスト</div>
                                    </div>
                                </div>
                                <svg
                                    className={`w-5 h-5 text-secondary-400 transition-transform ${
                                        expandedUrls.has(group.url) ? 'rotate-180' : ''
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {expandedUrls.has(group.url) && (
                                <div className="border-t border-secondary-200">
                                    {group.texts.map((text) => (
                                        <div
                                            key={text.id}
                                            className="px-4 py-3 border-b border-secondary-100 last:border-0 hover:bg-secondary-50 group"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div
                                                    className="flex-1 cursor-pointer"
                                                    onClick={() => handleTextClick(text)}
                                                >
                                                    {text.context_before && (
                                                        <span className="text-secondary-400 text-sm">...{text.context_before}</span>
                                                    )}
                                                    <span className="text-secondary-900 font-medium">{text.text}</span>
                                                    {text.context_after && (
                                                        <span className="text-secondary-400 text-sm">{text.context_after}...</span>
                                                    )}
                                                    <div className="text-xs text-secondary-500 mt-1">
                                                        {new Date(text.created_at).toLocaleString('ja-JP')}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedTextId(text.id);
                                                            setShowProjectModal(true);
                                                        }}
                                                        className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                                                    >
                                                        参照として追加
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(text.id);
                                                        }}
                                                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                                    >
                                                        削除
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showProjectModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowProjectModal(false)}>
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4 text-secondary-900">プロジェクトを選択</h2>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {projects.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => handleSaveToProject(project.id)}
                                    className="w-full px-4 py-3 text-left border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors flex items-center gap-3"
                                >
                                    <span className="text-2xl">{project.icon}</span>
                                    <div>
                                        <div className="font-medium text-secondary-900">{project.name}</div>
                                        {project.description && (
                                            <div className="text-sm text-secondary-500">{project.description}</div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowProjectModal(false)}
                            className="mt-4 w-full px-4 py-2 bg-secondary-200 text-secondary-700 rounded-lg hover:bg-secondary-300"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

