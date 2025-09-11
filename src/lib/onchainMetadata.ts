import { Connection, PublicKey } from "@solana/web3.js";

const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// ---- helpers shared with offchain ----
function toHttp(uri?: string): string | undefined {
  if (!uri) return;
  const u = uri.replace(/\0/g, "").trim();

  // bare CID like "Qm..." -> treat as ipfs
  if (/^[1-9A-HJ-NP-Za-km-z]{46,}$/.test(u)) {
    return `https://cloudflare-ipfs.com/ipfs/${u}`;
  }

  if (u.startsWith("ipfs://")) {
    const path = u.slice(7).replace(/^ipfs\//, "");
    return `https://cloudflare-ipfs.com/ipfs/${path}`;
  }
  if (u.startsWith("ar://")) {
    const id = u.slice(5);
    return `https://arweave.net/${id}`;
  }
  return u;
}

function sanitizeString(str?: string): string | null {
  if (!str) return null;
  // keep UTF-8, strip nulls & control chars
  const cleaned = str
    .replace(/\0/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim();
  return cleaned.length ? cleaned : null;
}

function sanitizeUri(uri?: string): string | null {
  if (!uri) return null;
  const cleaned = uri.replace(/\0/g, "").trim();
  if (cleaned.length > 1024) return null;

  // accept http(s), ipfs, ar
  if (/^(https?:\/\/|ipfs:\/\/|ar:\/\/)/i.test(cleaned)) return cleaned;

  // accept bare CID
  if (/^[1-9A-HJ-NP-Za-km-z]{46,}$/.test(cleaned)) return `ipfs://${cleaned}`;

  return null;
}

async function safeFetchJson(uri: string): Promise<any | null> {
  const normalized = toHttp(uri);
  if (!normalized) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10s to avoid premature failures

  try {
    const res = await fetch(normalized, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'TokenTracker/2.0'
      }
    });
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") || "";

    // Try JSON no matter what — many gateways send octet-stream/text/plain
    try {
      const json = await res.json();
      return json ?? null;
    } catch {
      // Last chance: read text and parse if it looks like JSON
      const txt = await res.text();
      if (txt && txt.trim().startsWith("{")) {
        try { return JSON.parse(txt); } catch {}
      }
      // If server returned image directly, signal that via a pseudo JSON
      if (ct.startsWith("image/")) return { image: normalized };
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---- correct BORSH parsing of Token Metadata ----
function readBorshString(buf: Buffer, offsetRef: { o: number }): string {
  const { o } = offsetRef;
  if (o + 4 > buf.length) throw new Error("out of bounds (len)");
  const len = buf.readUInt32LE(o);
  offsetRef.o += 4;
  if (offsetRef.o + len > buf.length) throw new Error("out of bounds (str)");
  const s = buf.slice(offsetRef.o, offsetRef.o + len).toString("utf8");
  offsetRef.o += len;
  return s;
}

function parseMetadataAccount(
  data: Buffer
): { name?: string; symbol?: string; uri?: string } | null {
  try {
    const off = { o: 0 };
    // key (u8)
    off.o += 1;
    // update_authority (32) + mint (32)
    off.o += 32 + 32;

    // data struct
    const name = readBorshString(data, off);
    const symbol = readBorshString(data, off);
    const uri = readBorshString(data, off);

    // ignore sellerFeeBps/creators/flags/etc.
    return { name, symbol, uri };
  } catch (e) {
    console.error("Error parsing metadata (borsh):", e);
    return null;
  }
}

export async function getOnchainMetadata(
  connection: Connection,
  mintStr: string
): Promise<{ name?: string; symbol?: string; uri?: string; image?: string; description?: string }> {
  try {
    const mint = new PublicKey(mintStr);

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      METADATA_PROGRAM_ID
    );

    const account = await connection.getAccountInfo(pda, "confirmed");
    if (!account || !account.data?.length) return {};

    const md = parseMetadataAccount(account.data);
    if (!md) return {};

    const name = sanitizeString(md.name);
    const symbol = sanitizeString(md.symbol);
    const uri = sanitizeUri(md.uri);

    let json: any = {};
    if (uri) json = (await safeFetchJson(uri)) || {};

    return {
      name: name || json.name || undefined,
      symbol: symbol || json.symbol || undefined,
      uri: uri || undefined,
      image: json.image || json.image_url || json.properties?.image || json?.properties?.files?.[0]?.uri,
      description: json.description,
    };
  } catch (e) {
    console.error(`Error fetching metadata for ${mintStr}:`, e);
    return {};
  }
}



