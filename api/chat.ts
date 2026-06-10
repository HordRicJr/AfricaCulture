export default (req, res) => {
  return res.status(200).json({
    debug: true,
    message: "VERCEL HANDLER REACHED"
  });
};
