const express = require('express');
const app = express();

app.use(express.json());

// Root route (prevents 404 on GET /)
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Echoroom AI backend running' });
});

// Example API route
app.get('/api/health', (req, res) => {
  res.status(200).json({ healthy: true });
});

// Only run app.listen() locally; Vercel handles the server in production
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;