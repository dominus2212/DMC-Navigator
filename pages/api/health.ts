import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: "ok",
    note: "DB health is available at https://dmc-health.kj54yd2pdr.workers.dev/health",
  });
}
