import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authDestination, oauthDestinationCookie } from '@/lib/auth-navigation';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const destination = request.cookies.get(oauthDestinationCookie)?.value;
  function finish(path: string) {
    // A relative Location keeps the browser's actual host, including when a
    // development server or reverse proxy normalizes request.url internally.
    const response = new NextResponse(null, {
      status: 303,
      headers: { Location: path, 'Cache-Control': 'private, no-store' },
    });
    response.cookies.delete(oauthDestinationCookie);
    return response;
  }
  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return finish(authDestination(destination));
  }
  return finish(`/account?error=${destination ? 'oauth' : 'confirmation'}`);
}
