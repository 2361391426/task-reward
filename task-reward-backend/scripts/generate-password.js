// Generate merchant password hash
const bcrypt = require('bcryptjs');

async function generatePassword() {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);

  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nUse this hash in the merchant seed data.');
}

generatePassword();
