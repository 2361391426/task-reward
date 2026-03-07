// 生成商家密码哈希
const bcrypt = require('bcrypt');

async function generatePassword() {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);

  console.log('原始密码:', password);
  console.log('加密后的哈希:', hash);
  console.log('\n将此哈希值用于数据库初始化脚本中的商家密码字段');
}

generatePassword();
