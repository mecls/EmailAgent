/**
 * Thrown when the stored Google refresh token is no longer usable
 * (`invalid_grant` — revoked, or expired under testing-mode's 7-day window). The
 * UI catches this and prompts the user to reconnect Gmail.
 */
export class ReconnectRequiredError extends Error {
  readonly accountId: string
  constructor(accountId: string, message = 'Gmail reconnect required') {
    super(message)
    this.name = 'ReconnectRequiredError'
    this.accountId = accountId
  }
}
