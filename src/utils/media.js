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
      if (pathname.startsWith('/storage/')) return `${base}${pathname}`
      return `${base}/storage${pathname}`
    } catch {
      return url
    }
  }

  const cleanUrl = url.startsWith('/') ? url : `/${url}`
  if (cleanUrl.startsWith('/storage/')) {
    return `${base}${cleanUrl}`
  }
  
  return `${base}/storage${cleanUrl}`
}
