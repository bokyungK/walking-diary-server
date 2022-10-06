const express = require('express');
const app = express();
const cors = require('cors');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const mysql = require('mysql2');

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
app.post('/user', function (req, res) {
    const { userId, userPw, userName, userPetName } = req.body;
    db.query(`INSERT INTO user(id, pw, name, dog_name) VALUES('${userId}', '${userPw}', '${userName}', '${userPetName}')`);
    res.send(typeof userId);
});
app.listen(3001, () => {
    console.log('익스프레스 서버 실행');
});