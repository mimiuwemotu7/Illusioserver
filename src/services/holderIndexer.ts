import { Connection, PublicKey } from "@solana/web3.js";
import { TokenRepository } from "../db/repository";
import { logger } from "../utils/logger";
import * as cron from "node-cron";

// Import wsService dynamically to avoid circular dependency
let wsService: any = null;
const getWsService = () => {
    if (!wsService) {
        try {
            wsService = require('../app').wsService;
        } catch (error) {
            console.warn('WebSocket service not available:', error);
        }
    }
    return wsService;
};

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

export class HolderIndexer {
  private cronJob?: cron.ScheduledTask;
  private running = false;

  constructor(
    private conn: Connection,
    private repo: TokenRepository
  ) {}

  start() {
    if (this.running) return;
    // every 30 seconds for ULTRA FAST holder updates
    this.cronJob = cron.schedule("*/30 * * * * *", async () => {
      try {
        await this.indexSome(50); // snapshot 50 fresh mints per tick
      } catch (e) {
        logger.error("holder indexer tick error", e);
      }
    });
    this.running = true;
    logger.info("✅ HolderIndexer started");
  }

  stop() {
    this.cronJob?.stop();
    this.cronJob = undefined;
    this.running = false;
    logger.info("✅ HolderIndexer stopped");
  }

  // Grab a set of mints you care about (fresh/active/recent)
  private async pickMints(limit = 50): Promise<string[]> {
    // Prioritize fresh tokens for holder indexing
    const freshTokens = await this.repo.findFreshTokens(limit, 0);
    return freshTokens.map(t => t.mint);
  }

  async indexSome(limit = 50) {
    const mints = await this.pickMints(limit);
    if (!mints.length) return;

    for (const mint of mints) {
      await this.snapshotHolders(mint).catch(e =>
        logger.warn(`holders snapshot failed for ${mint}: ${String(e)}`)
      );
      await new Promise(r => setTimeout(r, 50)); // faster pacing for fresh tokens
    }
  }

  private async snapshotHolders(mintStr: string) {
    // const mint = new PublicKey(mintStr); // Unused for now

    // query both programs
    const [a, b] = await Promise.all([
      this.queryHoldersFromProgram(TOKEN_PROGRAM_ID, mintStr),
      this.queryHoldersFromProgram(TOKEN_2022_PROGRAM_ID, mintStr),
    ]);

    const all = [...a, ...b];

    // merge by owner (some wallets may have both program accounts)
    const merged = new Map<string, { owner: string; amount: number; raw_amount: string }>();
    for (const r of all) {
      const prev = merged.get(r.owner);
      if (prev) {
        merged.set(r.owner, {
          owner: r.owner,
          amount: prev.amount + r.amount,
          raw_amount: (BigInt(prev.raw_amount) + BigInt(r.raw_amount)).toString(),
        });
      } else {
        merged.set(r.owner, r);
      }
    }

    const rows = [...merged.values()]
      .filter(r => r.amount > 0)
      .sort((x, y) => y.amount - x.amount);

    await this.repo.upsertTokenHoldersByMint(mintStr, rows);
    logger.debug(`holders snapshot for ${mintStr}: ${rows.length} holders`);
    
    // Broadcast holder update via WebSocket
    const ws = getWsService();
    if (ws) {
      const updatedToken = await this.repo.findByMint(mintStr);
      if (updatedToken) {
        ws.broadcastTokenUpdate(updatedToken);
      }
    }
  }

  private async queryHoldersFromProgram(programId: PublicKey, mintStr: string) {
    try {
      const accounts = await this.conn.getParsedProgramAccounts(programId, {
        filters: [
          { memcmp: { offset: 0, bytes: mintStr } }, // token account mint at offset 0
          // no dataSize filter to support token-2022 too
        ],
      });

      const out: { owner: string; amount: number; raw_amount: string }[] = [];
      for (const a of accounts) {
        const info: any = (a.account.data as any)?.parsed?.info;
        if (!info) continue;
        const owner = info.owner as string;
        const tok = info.tokenAmount;
        if (!tok) continue;
        const raw = String(tok.amount ?? "0");
        const decimals = Number(tok.decimals ?? 0);
        const human = Number(raw) / Math.pow(10, decimals);
        if (human <= 0) continue;
        out.push({ owner, amount: human, raw_amount: raw });
      }
      return out;
    } catch (e) {
      return [];
    }
  }
}
