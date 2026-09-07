export function notFoundHandler(request, response) {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route introuvable.' } });
}

export function errorHandler(error, request, response, next) { // eslint-disable-line no-unused-vars
  request.log?.error({ err: error }, 'Unhandled request error');
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue.' } });
}
