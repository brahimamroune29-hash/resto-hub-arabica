export function _genericDbError(err: unknown): Error {
  console.error("[server] db error", err);
  return new Error("حدث خطأ، يرجى المحاولة لاحقاً");
}