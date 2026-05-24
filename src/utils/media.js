export function getStorageBaseUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
  return apiUrl.replace(/\/api\/?$/, '')
}

export function resolveImageUrl(url) {
  if (!url) return null

  const base = getStorageBaseUrl()

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const { pathname } = new URL(url)
      return `${base}${pathname}`
    } catch {
      return url
    }
  }

  return `${base}${url.startsWith('/') ? url : `/${url}`}`
}
