const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 用户数据存储文件
const USER_DATA_FILE = path.join(__dirname, 'users.json');

// 从 Excel 读取用户数据
function loadUsersFromExcel() {
  const workbook = XLSX.readFile(path.join(__dirname, '..', 'web', 'password.xlsx'));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  // 转换为需要的格式并保存到 JSON 文件
  const users = data.reduce((acc, row) => {
    acc[row.账号] = {
      name: row.姓名,
      password: row.密码 || '111111' // 如果没有密码则使用默认密码
    };
    return acc;
  }, {});
  
  fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users, null, 2));
  return users;
}

// 获取或初始化用户数据
function getUsers() {
  try {
    if (fs.existsSync(USER_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8'));
    }
    return loadUsersFromExcel();
  } catch (err) {
    console.error('Failed to load users:', err);
    return {};
  }
}

// 保存用户数据
function saveUsers(users) {
  fs.writeFileSync(USER_DATA_FILE, JSON.stringify(users, null, 2));
}

// 登录接口
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();
  const user = users[username];
  
  if (!user) {
    return res.status(401).json({ error: '账号无效，请确认学号' });
  }
  
  if (user.password !== password) {
    return res.status(401).json({ error: '密码错误' });
  }
  
  res.json({ success: true, name: user.name });
});

// 修改密码接口
app.post('/api/change-password', (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const users = getUsers();
  const user = users[username];
  
  if (!user) {
    return res.status(401).json({ error: '账号无效' });
  }
  
  if (user.password !== oldPassword) {
    return res.status(401).json({ error: '原密码错误' });
  }
  
  user.password = newPassword;
  saveUsers(users);
  
  res.json({ success: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  // 初始化时加载一次 Excel
  getUsers();
});
