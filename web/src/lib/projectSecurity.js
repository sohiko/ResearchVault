import { supabase } from './supabase'

// These RPCs return only names for people in a project the caller may read.
export async function projectPeople(projectId) {
  const { data, error } = await supabase.rpc('get_project_people', { p_project_id: projectId })
  if (error) { throw error }
  return new Map((data || []).map(person => [person.id, { name: person.name }]))
}

export async function projectWithPeople(project) {
  const people = await projectPeople(project.id)
  return {
    ...project,
    owner: people.get(project.owner_id),
    profiles: people.get(project.owner_id),
    project_members: project.project_members?.map(member => ({
      ...member, profiles: people.get(member.user_id)
    }))
  }
}

export async function findProjectInvitee(projectId, email) {
  const { data, error } = await supabase.rpc('find_project_invitee', {
    p_project_id: projectId, p_email: email.trim().toLowerCase()
  })
  if (error) { throw error }
  return data?.[0] || null
}

export async function authorizeProjectLink(projectId, token) {
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    throw new Error('共有リンクが正しくありません')
  }
  const { error } = await supabase.rpc('authorize_project_link', {
    p_project_id: projectId, p_token: token
  })
  if (error) { throw error }
}
