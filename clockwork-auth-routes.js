const router = require('express').Router();

// Simple test routes
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working!' });
});

router.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint' });
});

module.exports = router;
