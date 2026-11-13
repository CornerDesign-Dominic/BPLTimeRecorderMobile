import { getMainVacationStatus, getVacationRequestKind, getVacationRequestStatus } from './vacationStatus.js'

export function hasOpenVacationRequest(item, requests) {
  return getMainVacationStatus(item) === 'pending' || requests.some(child => (child.vacationId || child.originalRequestId) === item.id && getVacationRequestStatus(child) === 'pending')
}

export function filterVacationRequests(requests, { year, filter = 'all', today }) {
  return requests.filter(item => {
    if (getVacationRequestKind(item) !== 'vacation' || item.startDate > `${year}-12-31` || item.endDate < `${year}-01-01`) return false
    const status = getMainVacationStatus(item)
    if (filter === 'pending') return hasOpenVacationRequest(item, requests)
    if (filter === 'upcoming') return ['approved', 'manual'].includes(status) && item.endDate >= today
    if (filter === 'past') return item.endDate < today
    if (filter === 'closed') return ['rejected', 'cancelled', 'withdrawn'].includes(status)
    return true
  }).sort((a, b) => b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id))
}
