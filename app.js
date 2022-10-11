const express = require('express');
const app = express();
const cors = require('cors');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const cookieParser = require('cookie-parser');
const { auth } = require('./middleware/auth');

// database 연동
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'gombobbaeng',
    database: 'walking_diary'
});
db.connect();

app.use(cors({origin: 'http://localhost:3000', credentials: true}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


// join 
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

// login
app.post('/login', function (req, res) {
    const { userId, userPw } = req.body;
    db.query(`SELECT pw FROM user WHERE id='${userId}'`, async function (err, rows, fields) {
        if (rows.length === 0) {
            res.send('Fail_id');
            return
        }
        if (await argon2.verify(rows[0].pw, userPw)) {
            const access_token = jwt.sign({ userId } , 'secure');
            res.cookie('access_token', access_token);
            res.send('Success');
        } else {
            res.send('Fail_pw');
        }
    });
})

// mypage
app.get('/info', function (req, res) {
    const { access_token } = req.cookies;
    if (!access_token) {
        res.send('There is no access_token');
        return;
    }
    const { userId } = jwt.verify(access_token, 'secure');
    db.query(`SELECT name, id, dog_name FROM user WHERE id='${userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
        res.send(rows);
    })
})

// withdrawal
app.get('/withdrawal', function (req, res) {
    const { access_token } = req.cookies;
    if (!access_token) {
        res.send('There is no access_token');
        return;
    }
    const { userId } = jwt.verify(access_token, 'secure');
    db.query(`DELETE FROM user WHERE id='${userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
        res.send('Success');
    })
    // dog, diary 테이블 정보도 삭제되도록 추가하기!
})

// logout
app.get('/logout', function (req, res) {
    const { access_token } = req.cookies;
    if (!access_token) {
        res.send('There is no access_token');
        return;
    }
    const { userId } = jwt.verify(access_token, 'secure');
    db.query(`SELECT name, id, dog_name FROM user WHERE id='${userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
        res.send('Success');
    })
})

app.listen(3001, () => {
    console.log('Server is running!');
});