const fs = require('fs');
const express = require('express');
const app = express();
const cors = require('cors');
const mysql = require('mysql2');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer  = require('multer')
const path = require("path");
const storage = multer.diskStorage({
    destination: './photos',
    filename: function(req, file, cb) {
        cb(null, new Date().valueOf() + path.extname(file.originalname));
    }
  });
const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 }
});
// const { auth } = require('./middleware/auth');

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
app.use(express.static('photos'));



// Join 
app.post('/join', async function (req, res) {
    const { userId, userPw, userName } = req.body;
    const hash = await argon2.hash(userPw);

    db.query(`INSERT INTO user(id, pw, name) VALUES('${userId}', '${hash}', '${userName}')`,
    function (err, rows, fields) {
        if (err) {
            res.send('Fail');
            return;
        }
        res.send('Success');
    })
});

// Login
app.post('/login', function (req, res) {
    const { userId, userPw } = req.body;

    db.query(`SELECT pw FROM user WHERE id='${userId}'`, async function (err, rows, fields) {
        if (rows.length === 0) {
            res.send('Fail_id');
            return;
        }
        if (await argon2.verify(rows[0].pw, userPw)) {
            const access_token = jwt.sign({ userId } , 'secure');
            res.cookie('access_token', access_token, {
                httpOnly: true,
                maxAge: 3600000,
            });
            res.send('Success');
            return;
        }
        res.send('Fail_pw');
    });
})

// Mypage
app.get('/info', function (req, res) {
    const { access_token } = req.cookies;

    if (!access_token) {
        res.send('There is no access_token');
        return;
    }

    const { userId } = jwt.verify(access_token, 'secure');

    db.query(`SELECT name, id FROM user WHERE id='${userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
        const res1 = rows[0];

        db.query(`SELECT dog_name_1, dog_name_2, dog_name_3 FROM dog WHERE id='${userId}'`, function(err, rows, fields) {
            if (rows.length === 0) {
                res.send(res1);
                return;
            }
            const res2 = rows[0];
            const res3 = Object.assign(res1, res2);
            res.send(res3);
        })
    })
})

app.post('/info', async function (req, res) {
    const { access_token } = req.cookies;
    const { userPw, userNewPw, userDogName1, userDogName2, userDogName3 } = req.body;
    const { userId } = jwt.verify(access_token, 'secure');

    // password
    if (userNewPw !== '') {
        if (!access_token) {
            res.send('There is no access_token');
            return;
        }
    
        db.query(`SELECT pw FROM user WHERE id='${userId}'`, async function(err, rows, fields) {
            if (rows.length === 0) {
                res.send('This is not a valid token');
                return;
            }
            if (!await argon2.verify(rows[0].pw, userPw)) {
                res.send('Password is not correct');
                return;
            }

            const newHash = await argon2.hash(userNewPw);
            db.query(`UPDATE user SET pw='${newHash}' WHERE id='${userId}'`, function(err, rows, fields) {
                if (err) {
                    res.send('This is not a valid token');
                    return;
                }
            })
        })
    }
    
    // dogs
    const dogNames = [userDogName1[1], userDogName2[1], userDogName3[1]];
    if (dogNames.includes(false)) {
        if (!access_token) {
            res.send('There is no access_token');
            return;
        }

        db.query(`SELECT pw FROM user WHERE id='${userId}'`, async function(err, rows, fields) {
            if (rows.length === 0) {
                res.send('This is not a valid token');
                return;
            }
            if (!await argon2.verify(rows[0].pw, userPw)) {
                res.send('Password is not correct');
                return;
            }
            db.query(`SELECT * FROM dog WHERE id='${userId}'`, function(err, rows, fields) {
                if (rows.length === 0) {
                    db.query(`INSERT INTO dog(id, dog_name_1, dog_name_2, dog_name_3) VALUES('${userId}', '${userDogName1[0]}', '${userDogName2[0]}', '${userDogName3[0]}')`,
                    function(err, rows, fields) {
                        res.send('Success');
                    })
                    return;
                }
                db.query('UPDATE dog SET' + 
                `${dogNames[0] === false ? ` dog_name_1='${userDogName1[0]}'` : ''}` +
                `${dogNames[1] === false ? `${dogNames[0] === false ? ',' : ''} dog_name_2='${userDogName2[0]}'` : ''}` +
                `${dogNames[2] === false ? `${dogNames[0] === false || dogNames[1] === false ? ',' : ''} dog_name_3='${userDogName3[0]}'` : ''}` +
                ` WHERE id='${userId}'`, function(err, rows, fields) {
                    if (err) {
                        console.log(err);
                    }
                })
            })
        })
        return;
    }
    res.send('Success');
})

// Mypage - withdrawal
app.get('/withdrawal', function (req, res) {
    const { access_token } = req.cookies;
    const { userId } = jwt.verify(access_token, 'secure');

    // auth
    if (!access_token) {
        res.send('There is no access_token');
        return;
    }

    db.query(`SELECT * FROM user WHERE id='${userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
    })

    // data
    const tables = ['diary', 'dog', 'user'];
    tables.forEach((table) => {
        db.query(`SELECT * FROM ${table} WHERE id='${userId}'`, async function(err, rows, fields) {
            if (!await argon2.verify(rows[0].pw, userPw)) {
                res.send('Fail');
                return;
            }
            if (rows.length !== 0) {
                db.query(`DELETE FROM ${table} WHERE id='${userId}'`, function(err, rows, fields) {
                    if (err) {
                        throw err;
                    }
                })
            }
        })
    })
    res.send('Success');

    // image
    const directory = `./photos/${userId}`;
    const isTrue = fs.existsSync(directory);
    if (isTrue) {
        fs.rmSync(directory , { recursive: true });
    }
})

// Mypage - logout
app.get('/logout', function (req, res) {
    const { access_token } = req.cookies;
    const { userId } = jwt.verify(access_token, 'secure');

    if (!access_token) {
        res.send('There is no access_token');
        return;
    }

    db.query(`SELECT name, id FROM user WHERE id='${userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
        res.send('Success');
    })
})

// WriteDiary
app.get('/get-dogs', function (req, res) {
    const { access_token } = req.cookies;

    if (!access_token) {
        res.send('There is no access_token');
        return;
    }

    const { userId } = jwt.verify(access_token, 'secure');

    db.query(`SELECT * FROM dog WHERE id='${userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
        res.send(rows[0]);
    })
})

app.post('/write-diary', upload.single('img'), function(req, res, next) {
    const { date, weather, selectedDog, title, content } = JSON.parse(req.body.info);
    const { access_token } = req.cookies;
    const { userId } = jwt.verify(access_token, 'secure');

    // auth
    if (!access_token) {
        res.send('There is no access_token');
        return;
    }
    db.query(`SELECT * FROM user WHERE id='${userId}'`, async function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
    })

    // data
    db.query(`SELECT * FROM diary WHERE id='${userId}'`, function(err, rows, fields) {
        const day = `${new Date().getFullYear()}-${new Date().getMonth() + 1 < 10 ? '0' + (new Date().getMonth() + 1) : new Date().getMonth() + 1}-${new Date().getDate() < 10 ? '0' + new Date().getDate() : new Date().getDate()}`;
        const fileName = {
            diaryLength: rows.length + 1,
            today: day.replace('-', '').replace('-', ''),
            path: path.extname(req.file.originalname),
        }
        const fileNewName = `${fileName.today}_${selectedDog}_${fileName.diaryLength}${fileName.path}`

        db.query(`INSERT INTO diary(id, date, weather, dog_name, title, content, image_name)
         VALUES('${userId}', '${date.join(' ')}', '${weather}', '${selectedDog}', '${title}', '${content}', '${fileNewName}')`, 
         function(err, rows, fields) {
            if (err) {
                console.log(err);
                return;
            }
            res.send('Success');
        })
        
        // image
        const directory = `./photos/${userId}`;
        const isTrue = fs.existsSync(directory);
        if (!isTrue) {
                fs.mkdirSync(directory);
        }

        fs.rename(`./photos/${req.file.filename}`, `./photos/${userId}/${fileNewName}`,
         function(err) {
            console.log(err);
         })
    })
})


// MyDiary
app.get('/diary', function(req, res) {

    // auth
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

    // data
    const resArr = [];
    db.query(`SELECT * FROM diary WHERE id='${userId}' AND starred='${true}'`, (err, rows, fields) => {
        if (rows.length === 0) {
            resArr[0] = '';
            return
        }
        resArr[0] = rows;
    })
    db.query(`SELECT * FROM diary WHERE id='${userId}'`, (err, rows, fields) => {
        if (rows.length === 0) {
            return
        }
        resArr[1] = rows;
        res.send(resArr);
    })
})

// DetailedDiary
app.post('/update-diary', (req, res) => {

    // auth
    const { access_token } = req.cookies;
    if (!access_token) {
        res.send('There is no access_token');
        return;
    }

    const { userId } = jwt.verify(access_token, 'secure');
    db.query(`SELECT * FROM user WHERE id='${userId}'`, async function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
    })

    // data
    const { weather, dogName, title, content, imageName } = req.body;
    db.query(`SELECT * FROM diary WHERE id='${userId}' AND image_name='${imageName}'`, (err, rows, fields) => {
        if (rows.length === 0) {
            return;
        }
        db.query(`UPDATE diary SET weather='${weather}', dog_name='${dogName}', title='${title}', content='${content}' WHERE id='${userId}' AND image_name='${imageName}'`,
        (err, rows, fields) => {
            if (err) {
                console.log(err);
                return;
            }
            res.send('Success');
        })
    })
})

app.post('/delete-diary', (req, res) => {

    // auth
    const { access_token } = req.cookies;
    if (!access_token) {
        res.send('There is no access_token');
        return;
    }

    const { userId } = jwt.verify(access_token, 'secure');
    db.query(`SELECT * FROM user WHERE id='${userId}'`, async function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('This is not a valid token');
            return;
        }
    })

    // data
    const { imageName } = req.body;
    db.query(`DELETE FROM diary WHERE id='${userId}' AND image_name='${imageName}'`, async function(err, rows, fields) {
        res.send('Success');
    })
})

app.post('/starred', (req, res) => {
    const { starred, imageName } = req.body;

        // auth
        const { access_token } = req.cookies;
        if (!access_token) {
            res.send('There is no access_token');
            return;
        }
    
        const { userId } = jwt.verify(access_token, 'secure');
        db.query(`SELECT * FROM user WHERE id='${userId}'`, async function(err, rows, fields) {
            if (rows.length === 0) {
                res.send('This is not a valid token');
                return;
            }
        })

        // data
        db.query(`UPDATE diary SET starred='${starred}' WHERE id='${userId}' AND image_name='${imageName}'`, (err, rows, fields) => {
        })
})


app.listen(3001, () => {
    console.log('Server is running!');
});