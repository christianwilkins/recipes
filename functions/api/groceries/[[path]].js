import { handleGroceries } from '../../../lib/groceries.mjs';

export function onRequest({request, env}) {
  return handleGroceries(request, env.DB);
}
