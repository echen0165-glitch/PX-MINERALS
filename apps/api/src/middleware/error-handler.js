export function notFoundHandler(request, response) {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route introuvable.' } });
}

export function errorHandler(error, request, response, next) { // eslint-disable-line no-unused-vars
  request.log?.error({ err: error }, 'Unhandled request error');
  // Ligne courte, lisible dans Netlify, sans données de connexion ni secret.
  console.error(`PX_MINERALS_ERROR code=${error.code ?? 'UNKNOWN'} message=${error.message ?? 'Unknown error'}`);
  if (error.message === 'EMAIL_DELIVERY_FAILED' || error.message === 'EMAIL_NOT_CONFIGURED') {
    return response.status(503).json({ error: {
      code: 'EMAIL_UNAVAILABLE',
      message: 'Le service d’e-mail est temporairement indisponible. Réessayez dans quelques minutes ou contactez le support.'
    } });
  }
  const unavailableCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', '08000', '08001', '08003', '08006', '53300', '57P01', '57P03']);
  if (unavailableCodes.has(error.code)) {
    return response.status(503).json({ error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Le service est temporairement indisponible. Réessayez dans quelques instants.'
    } });
  }
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.' } });
}
