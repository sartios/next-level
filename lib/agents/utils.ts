export const parseErrorInfo = (err: unknown) => ({
  exceptionType: err instanceof Error ? err.name || err.constructor.name : 'Error',
  message: err instanceof Error ? err.message : String(err),
  traceback: err instanceof Error ? err.stack || '' : ''
});
