import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authDestination, oauthDestinationCookie } from '@/lib/auth-navigation';
import { recoveryCookie, recoveryGrant } from '@/lib/password-recovery';
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
    let recovering = false;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') recovering = true;
    });
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        if (recovering) {
          const response = finish('/account/reset-password');
          response.cookies.set(recoveryCookie, recoveryGrant(data.user.id), {
            httpOnly: true,
            secure: request.nextUrl.protocol === 'https:',
            sameSite: 'lax',
            path: '/',
            maxAge: 900,
          });
          return response;
        }
        const response = finish(authDestination(destination));
        response.cookies.delete(recoveryCookie);
        return response;
      }
    } finally {
      listener.subscription.unsubscribe();
    }
  }
  return finish(`/account?error=${destination ? 'oauth' : 'confirmation'}`);
}
