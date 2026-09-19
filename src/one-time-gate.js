import { DurableObject } from "cloudflare:workers";

const CLAIM_TTL_MS = 120000;

export class OneTimeCredentialGate extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS gate_state (" +
        "id INTEGER PRIMARY KEY CHECK (id = 1), " +
        "status TEXT NOT NULL, " +
        "claim_id TEXT, " +
        "expires_at INTEGER)"
      );
    });
  }

  claim() {
    const now = Date.now();
    const claimId = crypto.randomUUID();
    this.ctx.storage.sql.exec(
      "INSERT INTO gate_state (id, status, claim_id, expires_at) VALUES (1, 'claimed', ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET status = 'claimed', claim_id = excluded.claim_id, expires_at = excluded.expires_at " +
      "WHERE gate_state.status = 'released' OR gate_state.expires_at <= ?",
      claimId,
      now + CLAIM_TTL_MS,
      now
    );
    const row = this.ctx.storage.sql.exec("SELECT status, claim_id, expires_at FROM gate_state WHERE id = 1").toArray()[0] || null;
    return row?.status === "claimed" && row?.claim_id === claimId ? claimId : null;
  }

  consume(claimId) {
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "UPDATE gate_state SET status = 'consumed', claim_id = NULL, expires_at = NULL " +
      "WHERE id = 1 AND status = 'claimed' AND claim_id = ? AND expires_at > ?",
      claimId,
      now
    );
    const row = this.ctx.storage.sql.exec("SELECT status, claim_id FROM gate_state WHERE id = 1").toArray()[0] || null;
    return row?.status === "consumed" && row?.claim_id == null;
  }

  release(claimId) {
    this.ctx.storage.sql.exec("DELETE FROM gate_state WHERE id = 1 AND status = 'claimed' AND claim_id = ?", claimId);
    const row = this.ctx.storage.sql.exec("SELECT status FROM gate_state WHERE id = 1").toArray()[0] || null;
    return row == null;
  }
}