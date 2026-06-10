import type { VercelRequest, VercelResponse } from "@vercel/node";

console.log("=== PING FILE LOADED ===");

export default (req: VercelRequest, res: VercelResponse) => {
  console.log("=== PING HANDLER EXECUTED ===", req.method, req.url);
  return res.status(200).json({ message: "pong" });
};
