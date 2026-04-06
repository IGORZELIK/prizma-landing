export default function handler(req, res) {
  const country = (req.headers['x-vercel-ip-country'] || '').toUpperCase();
  res.status(200).json({ country_code: country });
}
