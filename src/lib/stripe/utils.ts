export const getStripeAuthLink = (url: string, data: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  const clientId = process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID
  
  if (!baseUrl || !clientId) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_BASE_URL or NEXT_PUBLIC_STRIPE_CLIENT_ID')
  }
  
  // Ensure baseUrl doesn't have a trailing slash and url starts with a slash
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  const cleanUrl = url.startsWith('/') ? url : `/${url}`
  const redirectUri = `${cleanBaseUrl}${cleanUrl}`
  const encodedRedirectUri = encodeURIComponent(redirectUri)
  const encodedState = encodeURIComponent(data)
  
  return `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=read_write&redirect_uri=${encodedRedirectUri}&state=${encodedState}`
}