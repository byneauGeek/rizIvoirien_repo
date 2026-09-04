import { API_BASE as BASE } from '../config'

let _onUnauthorized = null
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn }

async function request(method, path, body) {
  const token = localStorage.getItem('rz_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    localStorage.removeItem('rz_token')
    localStorage.removeItem('rz_user')
    if (_onUnauthorized) _onUnauthorized()
    throw new Error('Session expirée. Veuillez vous reconnecter.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
  return data
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
}

export async function uploadImages(files) {
  const token = localStorage.getItem('rz_token')
  const form = new FormData()
  for (const f of files) form.append('files', f)
  const res = await fetch(`${BASE}/upload/multiple`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Erreur upload images')
  return data.urls || []
}

export async function uploadCsv(path, file) {
  const token = localStorage.getItem('rz_token')
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Erreur upload')
  return data
}
