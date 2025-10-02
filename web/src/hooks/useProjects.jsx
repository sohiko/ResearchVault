import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { toast } from 'react-hot-toast'

// プロジェクトコンテキストの作成
const ProjectContext = createContext({
  projects: [],
  currentProject: null,
  loading: true,
  createProject: async () => {},
  updateProject: async () => {},
  deleteProject: async () => {},
  setCurrentProject: () => {},
  refreshProjects: async () => {},
  inviteMember: async () => {},
  removeMember: async () => {},
  updateMemberRole: async () => {}
})

// プロジェクトプロバイダーコンポーネント
export function ProjectProvider({ children }) {
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [, setSubscription] = useState(null)

  // プロジェクト一覧の取得
  const fetchProjects = useCallback(async () => {
    const userId = user?.id
    if (!userId) {
      setProjects([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // 所有プロジェクトを取得
      const { data: ownedProjects, error: ownedError } = await supabase
        .from('projects')
        .select(`
          *,
          references(id),
          owner:profiles!owner_id(name, email)
        `)
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })

      if (ownedError) {throw ownedError}

      // メンバープロジェクトを取得
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select(`
          role,
          joined_at,
          profiles(name, email),
          projects(
            *,
            references(id),
            owner:profiles!owner_id(name, email),
            project_members(
              role,
              joined_at,
              profiles(name, email)
            )
          )
        `)
        .eq('user_id', userId)

      if (memberError) {throw memberError}

      // データを統合・整形
      const allProjects = [
        // 所有プロジェクト
        ...(ownedProjects || []).map(project => ({
          ...project,
          referenceCount: project.references?.length || 0,
          memberCount: 1, // 所有者のみ
          members: [{
            role: 'owner',
            joinedAt: project.created_at,
            user: project.owner
          }],
          isOwner: true,
          userRole: 'owner'
        })),
        // メンバープロジェクト
        ...(memberData || []).map(member => ({
          ...member.projects,
          referenceCount: member.projects.references?.length || 0,
          memberCount: member.projects.project_members?.length || 0,
          members: member.projects.project_members?.map(pm => ({
            role: pm.role,
            joinedAt: pm.joined_at,
            user: pm.profiles
          })) || [],
          isOwner: false,
          userRole: member.role
        }))
      ]

      // 重複を排除して更新日順でソート
      const uniqueProjects = allProjects
        .filter((project, index, self) => 
          index === self.findIndex(p => p.id === project.id)
        )
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))

      setProjects(uniqueProjects)
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      toast.error('プロジェクトの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [user?.id]) // user.idのみに依存

  // 初期データの読み込み
  useEffect(() => {
    if (user?.id) {
      fetchProjects()
    }
  }, [user?.id]) // fetchProjectsを依存配列から削除して循環依存を回避

  // リアルタイム購読の設定
  useEffect(() => {
    if (!user?.id) {return}

    // プロジェクトの変更を監視
    const projectSubscription = supabase
      .channel(`user-projects-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects'
      }, (payload) => {
        console.log('Project change detected:', payload)
        fetchProjects() // プロジェクト一覧を再取得
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public', 
        table: 'project_members'
      }, (payload) => {
        console.log('Project member change detected:', payload)
        fetchProjects() // プロジェクト一覧を再取得
      })
      .subscribe()

    setSubscription(projectSubscription)

    return () => {
      if (projectSubscription) {
        supabase.removeChannel(projectSubscription)
      }
    }
  }, [user?.id]) // fetchProjectsを依存配列から削除して循環依存を回避

  // プロジェクトの作成
  const createProject = async (projectData) => {
    if (!user) {
      toast.error('ログインが必要です')
      return { data: null, error: new Error('User not authenticated') }
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          description: projectData.description || '',
          owner_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {throw error}

      // プロファイルが存在しない場合は作成
      await ensureProfile(user)

      // オーナーをメンバーとして追加
      const { error: memberError } = await supabase
        .from('project_members')
        .insert({
          project_id: data.id,
          user_id: user.id,
          role: 'admin',
          joined_at: new Date().toISOString()
        })

      if (memberError) {
        console.error('Failed to add owner as member:', memberError)
        // エラーでも続行（オーナーなので問題ない）
      }

      toast.success('プロジェクトを作成しました')
      await fetchProjects() // プロジェクト一覧を更新
      
      return { data, error: null }
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error('プロジェクトの作成に失敗しました')
      return { data: null, error }
    }
  }

  // プロジェクトの更新
  const updateProject = async (projectId, updates) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .select()
        .single()

      if (error) {throw error}

      toast.success('プロジェクトを更新しました')
      await fetchProjects() // プロジェクト一覧を更新
      
      return { data, error: null }
    } catch (error) {
      console.error('Failed to update project:', error)
      toast.error('プロジェクトの更新に失敗しました')
      return { data: null, error }
    }
  }

  // プロジェクトの削除
  const deleteProject = async (projectId) => {
    try {
      // まず参照をすべて削除
      const { error: referencesError } = await supabase
        .from('references')
        .delete()
        .eq('project_id', projectId)

      if (referencesError) {
        console.error('Failed to delete references:', referencesError)
        // 参照削除エラーでも続行
      }

      // プロジェクトメンバーを削除
      const { error: membersError } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)

      if (membersError) {
        console.error('Failed to delete members:', membersError)
        // メンバー削除エラーでも続行
      }

      // プロジェクトを削除
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) {throw error}

      toast.success('プロジェクトを削除しました')
      
      // 現在のプロジェクトが削除されたプロジェクトの場合はクリア
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
      }
      
      await fetchProjects() // プロジェクト一覧を更新
      
      return { error: null }
    } catch (error) {
      console.error('Failed to delete project:', error)
      toast.error('プロジェクトの削除に失敗しました')
      return { error }
    }
  }

  // メンバーの招待
  const inviteMember = async (projectId, email, role = 'viewer') => {
    try {
      // まず招待するユーザーが存在するかチェック
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      if (userError || !userData) {
        toast.error('指定されたメールアドレスのユーザーが見つかりません')
        return { data: null, error: userError || new Error('User not found') }
      }

      // 既にメンバーかチェック
      const { data: existingMember } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userData.id)
        .single()

      if (existingMember) {
        toast.error('このユーザーは既にプロジェクトのメンバーです')
        return { data: null, error: new Error('User already member') }
      }

      // メンバーを追加
      const { data, error } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: userData.id,
          role,
          joined_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {throw error}

      toast.success('メンバーを招待しました')
      await fetchProjects() // プロジェクト一覧を更新
      
      return { data, error: null }
    } catch (error) {
      console.error('Failed to invite member:', error)
      toast.error('メンバーの招待に失敗しました')
      return { data: null, error }
    }
  }

  // メンバーの削除
  const removeMember = async (projectId, userId) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (error) {throw error}

      toast.success('メンバーを削除しました')
      await fetchProjects() // プロジェクト一覧を更新
      
      return { error: null }
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast.error('メンバーの削除に失敗しました')
      return { error }
    }
  }

  // メンバーロールの更新
  const updateMemberRole = async (projectId, userId, newRole) => {
    try {
      const { data, error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {throw error}

      toast.success('メンバーロールを更新しました')
      await fetchProjects() // プロジェクト一覧を更新
      
      return { data, error: null }
    } catch (error) {
      console.error('Failed to update member role:', error)
      toast.error('メンバーロールの更新に失敗しました')
      return { data: null, error }
    }
  }

  // プロファイルの確認・作成
  const ensureProfile = async (user) => {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existingProfile) {
        const { error } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email.split('@')[0],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (error) {
          console.error('Failed to create profile:', error)
        }
      }
    } catch (error) {
      console.error('Failed to ensure profile:', error)
    }
  }

  // 現在のプロジェクトの設定
  const handleSetCurrentProject = (project) => {
    setCurrentProject(project)
    if (project) {
      localStorage.setItem('researchvault-current-project', project.id)
    } else {
      localStorage.removeItem('researchvault-current-project')
    }
  }

  // 保存された現在のプロジェクトの復元
  useEffect(() => {
    if (projects.length > 0 && !currentProject) {
      const savedProjectId = localStorage.getItem('researchvault-current-project')
      if (savedProjectId) {
        const savedProject = projects.find(p => p.id === savedProjectId)
        if (savedProject) {
          setCurrentProject(savedProject)
        }
      }
    }
  }, [projects, currentProject])

  // プロジェクト統計の取得
  const getProjectStats = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return {
      referenceCount: project?.referenceCount || 0,
      memberCount: project?.memberCount || 0,
      createdAt: project?.created_at,
      updatedAt: project?.updated_at
    }
  }

  // ユーザーの権限チェック
  const canEditProject = (project) => {
    if (!user || !project) {return false}
    return project.owner_id === user.id || project.userRole === 'admin'
  }

  const canDeleteProject = (project) => {
    if (!user || !project) {return false}
    return project.owner_id === user.id
  }

  const canInviteMembers = (project) => {
    if (!user || !project) {return false}
    return project.owner_id === user.id || project.userRole === 'admin'
  }

  const value = {
    projects,
    currentProject,
    loading,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject: handleSetCurrentProject,
    refreshProjects: fetchProjects,
    inviteMember,
    removeMember,
    updateMemberRole,
    getProjectStats,
    canEditProject,
    canDeleteProject,
    canInviteMembers
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

// カスタムフック
export function useProjects() {
  const context = useContext(ProjectContext)
  
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider')
  }
  
  return context
}

export default useProjects
