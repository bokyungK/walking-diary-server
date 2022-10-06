const express = require('express');
const app = express();
const cors = require('cors');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const mysql = require('mysql2');

// database 연동
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'gombobbaeng',
    database: 'walking_diary'
});
db.connect();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));


// 회원가입 
app.post('/join', function (req, res) {
    const { userId, userPw, userName, userPetName } = req.body;
    db.query(`INSERT INTO user(id, pw, name, dog_name) VALUES('${userId}', '${userPw}', '${userName}', '${userPetName}')`);
    res.send('Success!');
});

// 로그인
app.post('/login', function (req, res) {
    const { userId, userPw } = req.body;
    userInfo = db.query(`SELECT pw FROM user WHERE id='${userId}'`, function (err, result, fields) {
        if (result[0].pw === userPw) {
            res.send('로그인 성공');
        } else {
            res.send('로그인 실패');
        }
    });
})



app.listen(3001, () => {
    console.log('Server is running!');
});