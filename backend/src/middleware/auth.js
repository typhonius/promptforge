const basicAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    // Don't set WWW-Authenticate header to avoid browser popup
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  const expectedPassword = process.env.APP_PASSWORD;

  if (!expectedPassword) {
    console.error('APP_PASSWORD not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (password !== expectedPassword) {
    // Don't set WWW-Authenticate header to avoid browser popup
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Store username for potential use in routes
  req.user = { username };
  next();
};

module.exports = basicAuth;