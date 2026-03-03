// Cloudflare Pages Function: /api/upload-receipt
// Accepts an authenticated file upload and stores it in an R2 bucket.
// Authentication: Firebase ID token in Authorization: Bearer <token> header.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

export function onRequestOptions() {
  return new Response(null, {
    headers: corsHeaders(),
  })
}

export async function onRequestPost(context) {
  const { request, env } = context

  const authHeader = request.headers.get('Authorization') || ''
  const match = authHeader.match(/^Bearer (.+)$/)
  if (!match) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(),
      },
    })
  }

  const idToken = match[1]

  // Verify Firebase ID token with Google
  const tokenInfoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  )

  if (!tokenInfoRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid ID token' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(),
      },
    })
  }

  const tokenInfo = await tokenInfoRes.json()
  const userId = tokenInfo.sub
  const email = tokenInfo.email

  if (!userId || !email) {
    return new Response(JSON.stringify({ error: 'Token missing user information' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(),
      },
    })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const monthsCoveredRaw = formData.get('monthsCovered') || '[]'

  if (!file || typeof file === 'string') {
    return new Response(JSON.stringify({ error: 'No file uploaded' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(),
      },
    })
  }

  let monthsCovered = []
  try {
    monthsCovered = JSON.parse(monthsCoveredRaw)
  } catch {
    monthsCovered = []
  }

  const originalName = file.name || 'receipt'
  const safeName = originalName.replace(/[^a-z0-9.\-_]/gi, '_')
  const timestamp = Date.now()
  const objectKey = `${userId}/${timestamp}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const contentType = file.type || 'application/octet-stream'

  await env.RECEIPTS_BUCKET.put(objectKey, arrayBuffer, {
    httpMetadata: {
      contentType,
    },
  })

  const base = env.RECEIPTS_PUBLIC_BASE_URL
  const publicUrl = base
    ? `${String(base).replace(/\/$/, '')}/${objectKey}`
    : null

  return new Response(
    JSON.stringify({
      key: objectKey,
      publicUrl,
      userId,
      email,
      monthsCovered,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(),
      },
    }
  )
}

