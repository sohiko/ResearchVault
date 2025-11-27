import { supabase } from './supabase'

/**
 * ゴミ箱の自動クリーンアップ
 * 30日以上経過したアイテムを完全に削除する
 */
export async function cleanupTrash(userId) {
    if (!userId) { return }

    try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const threshold = thirtyDaysAgo.toISOString()

        // 1. 期限切れのプロジェクトを取得
        const { data: expiredProjects, error: projectsError } = await supabase
            .from('projects')
            .select('id')
            .eq('deleted_by', userId)
            .lt('deleted_at', threshold)

        if (projectsError) { throw projectsError }

        // 2. 期限切れの参照を取得
        const { data: expiredReferences, error: referencesError } = await supabase
            .from('references')
            .select('id')
            .eq('deleted_by', userId)
            .lt('deleted_at', threshold)

        if (referencesError) { throw referencesError }

        // 3. プロジェクト削除実行
        if (expiredProjects && expiredProjects.length > 0) {
            const projectIds = expiredProjects.map(p => p.id)
            const { error: deleteProjectsError } = await supabase
                .from('projects')
                .delete()
                .in('id', projectIds)

            if (deleteProjectsError) {
                console.error('Failed to cleanup expired projects:', deleteProjectsError)
            } else {
                console.log(`Cleaned up ${projectIds.length} expired projects`)
            }
        }

        // 4. 参照削除実行
        if (expiredReferences && expiredReferences.length > 0) {
            const referenceIds = expiredReferences.map(r => r.id)
            const { error: deleteReferencesError } = await supabase
                .from('references')
                .delete()
                .in('id', referenceIds)

            if (deleteReferencesError) {
                console.error('Failed to cleanup expired references:', deleteReferencesError)
            } else {
                console.log(`Cleaned up ${referenceIds.length} expired references`)
            }
        }

    } catch (error) {
        console.error('Trash cleanup failed:', error)
    }
}
