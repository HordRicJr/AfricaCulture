import type { VercelRequest, VercelResponse } from "@vercel/node";

export default (req: VercelRequest, res: VercelResponse) => {
  res.status(200).json({
    message: "Debug info",
    url: req.url,
    method: req.method,
    headers: req.headers
  });
};
