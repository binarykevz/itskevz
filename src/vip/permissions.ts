export class ForbiddenResourceError extends Error {
  constructor(message = "Forbidden resource") {
    super(message);
    this.name = "ForbiddenResourceError";
  }
}

export function assertSameUser(
  currentUserId: string,
  resourceOwnerId: string
): void {
  if (currentUserId !== resourceOwnerId) {
    throw new ForbiddenResourceError();
  }
}
