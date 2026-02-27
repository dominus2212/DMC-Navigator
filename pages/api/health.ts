import type { NextApiRequest, NextApiResponse } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const { env } = getCloudflareContext();
    const r = await env.DB.prepare("SELECT 1 as ok").first();
    res.status(200).json({ status: "ok", db: r?.ok ?? null });
  } catch (e: any) {
    res.status(500).json({
      status: "error",
      message: e?.message ?? String(e),
      stack: e?.stack ?? null,
    });
  }
}
