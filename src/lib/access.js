export function permitted(profile, module, edit = false) {
  if (profile?.active !== true) return false
  const permission = profile.permissions?.[module]
  return profile.role === 'superadmin' || permission === 'edit' || (!edit && permission === 'view')
}
