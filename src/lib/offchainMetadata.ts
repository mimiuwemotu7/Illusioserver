import { setTimeout as sleep } from "node:timers/promises";

const IPFS_GATEWAYS = [
  (cid: string) => `https://cloudflare-ipfs.com/ipfs/${cid}`,
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
  (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
];

const arUrl = (id: string) => `https://arweave.net/${id}`;
const IPFS_CID_RE = /^[1-9A-HJ-NP-Za-km-z]{46,}$/;
const AR_ID_RE   = /^[A-Za-z0-9_-]{40,64}$/; // arweave tx id-ish
const IMAGE_EXT  = /\.(png|jpg|jpeg|gif|webp|svg|bmp|tif|tiff)$/i;

export function toHttp(uri?: string): string | undefined {
  if (!uri) return;
  const u = uri.replace(/\0/g, "").trim();

  if (IPFS_CID_RE.test(u)) return IPFS_GATEWAYS[0](u);
  if (u.startsWith("ipfs://")) {
    const path = u.slice(7).replace(/^ipfs\//, "");
    return IPFS_GATEWAYS[0](path);
  }
  if (u.startsWith("ar://")) return arUrl(u.slice(5));
  return u; // http(s) or data:
}

function absolutize(img: string, base: string): string {
  const s = String(img).replace(/\0/g, "").trim();
  if (!s) return s;
  if (/^data:image\//i.test(s)) return s;
  if (/^(https?:\/\/|ipfs:\/\/|ar:\/\/)/i.test(s)) return s;

  // bare ids
  if (IPFS_CID_RE.test(s)) return `ipfs://${s}`;
  if (AR_ID_RE.test(s) && /arweave\.net/i.test(base)) return `https://arweave.net/${s}`;

  // relative path
  try { return new URL(s, base).toString(); } catch { return s; }
}

async function fetchWithTimeout(url: string, ms = 10_000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

function pickImageFromJson(j: any): string | undefined {
  if (!j || typeof j !== "object") return;

  // inline SVG
  if (j.image_data && String(j.image_data).trim().startsWith("<svg")) {
    const b64 = Buffer.from(String(j.image_data)).toString("base64");
    return `data:image/svg+xml;base64,${b64}`;
  }

  const cands: any[] = [];
  cands.push(j.image, j.image_url, j.imageURI, j.properties?.image, j.extensions?.image,
             j.logo, j.logoURI, j.icon, j.animation_url);

  const files = j.properties?.files || j.files;
  if (Array.isArray(files)) {
    for (const f of files) {
      if (typeof f === "string") cands.push(f);
      else if (f?.uri) cands.push(f.uri);
      else if (f?.cdn_uri) cands.push(f.cdn_uri);
    }
  }

  // Prefer real image-looking things
  for (const v of cands) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    if (s.startsWith("data:image/")) return s;
    if (/^(https?:\/\/|ipfs:\/\/|ar:\/\/)/i.test(s)) return s;
    if (IPFS_CID_RE.test(s) || AR_ID_RE.test(s) || IMAGE_EXT.test(s)) return s;
  }
  // fallback to any non-empty string
  return cands.find((v) => typeof v === "string" && v.trim()) as string | undefined;
}

export async function resolveImageUrl(uri?: string): Promise<string | undefined> {
  const url0 = toHttp(uri);
  if (!url0) return;

  const attemptParse = async (url: string) => {
    const res = await fetchWithTimeout(url);
    if (!res?.ok) return undefined;

    const ct = res.headers.get("content-type") || "";
    if (ct.startsWith("image/")) return url; // metadata URL was the image itself

    // try JSON regardless of type
    let json: any = null;
    try { json = await res.json(); }
    catch {
      const txt = await res.text().catch(() => "");
      if (txt?.trim().startsWith("{")) {
        try { json = JSON.parse(txt); } catch {}
      }
    }
    if (!json) return undefined;

    const raw = pickImageFromJson(json);
    if (!raw) return undefined;

    const abs = absolutize(raw, url);
    const http = toHttp(abs) ?? abs;
    return http;
  };

  try {
    const r = await attemptParse(url0);
    if (r) return r;
  } catch {}

  // rotate ipfs
  if (uri && (uri.startsWith("ipfs://") || IPFS_CID_RE.test(uri))) {
    const cid = uri.startsWith("ipfs://") ? uri.slice(7).replace(/^ipfs\//, "") : uri;
    for (let i = 1; i < IPFS_GATEWAYS.length; i++) {
      const url = IPFS_GATEWAYS[i](cid);
      try {
        const r = await attemptParse(url);
        if (r) return r;
      } catch {}
      await sleep(200);
    }
  }
  return undefined;
}