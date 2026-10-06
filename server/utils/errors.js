export class AppError extends Error {
  constructor(message, status = 400, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}
export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });
export function errorHandler(err, req, res, next) {
  const duplicate = err.code === 11000;
  const validation =
    err.name === "ValidationError" ||
    err.name === "ZodError" ||
    err.name === "CastError";
  const status = duplicate
    ? 409
    : validation
      ? 400
      : err.status || (err.code === "LIMIT_FILE_SIZE" ? 413 : 500);
  if (status >= 500) console.error(err.name, err.message);
  res.status(status).json({
    success: false,
    message: duplicate
      ? "Record already exists or a trip is already invoiced"
      : validation
        ? "Please check the submitted fields"
        : status >= 500
          ? "Unable to complete the request"
          : err.message,
    errors:
      err.issues?.map((x) => ({
        field: x.path.join("."),
        message: x.message,
      })) ||
      (err.errors instanceof Array && err.errors) ||
      [],
  });
}
