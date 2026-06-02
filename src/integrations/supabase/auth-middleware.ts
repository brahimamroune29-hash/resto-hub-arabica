import { createMiddleware } from '@tanstack/react-start'
import { getRequest, setResponseStatus } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'
import ws from 'ws'


function throwAuthError(message: string, status: number): never {
  setResponseStatus(status);
  throw new Error(message);
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
      ];
      const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`;
      console.error(`[Supabase] ${message}`);
      throwAuthError(message, 500);
    }
    
    const request = getRequest();

    if (!request?.headers) {
      throwAuthError('Unauthorized: No request headers available', 401);
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throwAuthError('Unauthorized: No authorization header provided', 401);
    }

    if (!authHeader.startsWith('Bearer ')) {
      throwAuthError('Unauthorized: Only Bearer tokens are supported', 401);
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throwAuthError('Unauthorized: No token provided', 401);
    }

    const supabase = createClient<Database>(
      SUPABASE_URL!,
      SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: { transport: ws },
      }
    );

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      throwAuthError('Unauthorized: Invalid token', 401);
    }

    if (!data.claims.sub) {
      throwAuthError('Unauthorized: No user ID found in token', 401);
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    })
  }
)
