export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({
    success: false,
    error: 'Updates run through the Update Exchange Data GitHub Actions workflow. Public requests cannot trigger upstream fetching.'
  });
}
