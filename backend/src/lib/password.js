const bcrypt = require('bcryptjs')

/**
 * Hash password for secure storage
 *
 * Never store plain passwords! Use bcrypt to hash them.
 * Even if someone steals the database, they can't read passwords.
 *
 * Rounds = 10 means bcrypt will process it 2^10 times (stronger = slower)
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

/**
 * Compare plain password with hashed password
 *
 * During login:
 * 1. User sends plain password
 * 2. We fetch hashed password from DB
 * 3. Use this function to verify they match
 */
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword)
}

module.exports = {
  hashPassword,
  verifyPassword,
}
