// An error whose message is safe to show the user, with the HTTP status the
// API route should return.
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}
