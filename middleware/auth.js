const mysql = require('mysql2');
const jwt = require('jsonwebtoken');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'gombobbaeng',
    database: 'walking_diary'
});
db.connect();

const checkUser = (req, res, next) => {
    const { access_token } = req.cookies;
    if (!access_token) {
        res.send('There is no access_token');
        return;
    }

    const { userId } = jwt.verify(access_token, 'secure');
    db.query(`SELECT * FROM user WHERE id='${userId}'`, async (err, rows, fields) => {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
    })

    res.locals.userId = userId;
    next();
}

module.exports = {
    checkUser,
}