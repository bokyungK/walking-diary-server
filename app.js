const express = require('express');
const app = express();
const cors = require('cors');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
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
app.post('/join', async function (req, res) {
    const { userId, userPw, userName, userPetName } = req.body;
    const hash = await argon2.hash(userPw);
    db.query(`INSERT INTO user(id, pw, name, dog_name) VALUES('${userId}', '${hash}', '${userName}', '${userPetName}')`,
    function (err, rows, fields) {
        if (rows) {
            res.send('Success');
            return;
        }
        if (err) {
            res.send('Fail');
        }
    });
});

// 로그인
app.post('/login', function (req, res) {
    const { userId, userPw } = req.body;
    db.query(`SELECT pw FROM user WHERE id='${userId}'`, async function (err, rows, fields) {
        if (rows.length === 0) {
            res.send('Fail_id');
        } else {
            if (await argon2.verify(rows[0].pw, userPw)) {
                res.send('Success');
            } else {
                res.send('Fail_pw');
            }
        }
    });
})


app.listen(3001, () => {
    console.log('Server is running!');
});