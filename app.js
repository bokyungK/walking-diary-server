const fs = require('fs');
const fsPromises = fs.promises;
const express = require('express');
const app = express();
const cors = require('cors');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer  = require('multer')
const path = require("path");
// const storage = multer.diskStorage({
//     destination: './photos',
//     filename: function(req, file, cb) {
//         cb(null, new Date().valueOf() + path.extname(file.originalname));
//     }
//   });
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 1000000 }
});
const { checkUser } = require('./middleware/auth');
const { db } = require('./middleware/db');

app.use(cors({origin: 'http://localhost:3000', credentials: true}));
// https://app.walking-diary-server.site
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static('uploads'));


// Banner
app.get('/calendar', checkUser, (req, res) => {
    // get writed dates
    db.query(`SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date FROM diary WHERE id='${res.locals.userId}' GROUP BY CAST(date AS DATE)`,
     async (err, rows, fields) => {
        if (rows.length === 0) {
            res.send('Nothing');
            return;
        }
        res.send(rows);
    })
})

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
                // 10000
                sameSite: 'none',
                secure: true,
            });
            res.send('Success');
            return;
        }
        res.send('Fail_pw');
    });
})

// Mypage
app.get('/info', checkUser, function (req, res) {
    // get user, dog tables info
    db.query(`SELECT name, id FROM user WHERE id='${res.locals.userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('Nothing');
            return;
        }

        const res1 = rows[0];

        db.query(`SELECT dog_name_1, dog_name_2, dog_name_3 FROM dog WHERE id='${res.locals.userId}'`, function(err, rows, fields) {
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

app.post('/info', checkUser, async function (req, res) {
    const { userPw, userNewPw, userDogName1, userDogName2, userDogName3 } = req.body;

    // password
    if (userNewPw !== '') {
        db.query(`SELECT pw FROM user WHERE id='${res.locals.userId}'`, async function(err, rows, fields) {
            if (!await argon2.verify(rows[0].pw, userPw)) {
                res.send('Password is not correct');
                return;
            }
    
            const newHash = await argon2.hash(userNewPw);
            db.query(`UPDATE user SET pw='${newHash}' WHERE id='${res.locals.userId}'`, function(err, rows, fields) {
                if (err) {
                    res.send('This is not a valid token');
                    return;
                }
            })
        })
    }
   
    // dogs
    const dogNames = [userDogName1, userDogName2, userDogName3];

    db.query(`SELECT * FROM dog WHERE id='${res.locals.userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            db.query(`INSERT INTO dog(id, dog_name_1, dog_name_2, dog_name_3) VALUES('${res.locals.userId}', '${dogNames[0]}', '${dogNames[1]}', '${dogNames[2]}')`,
            function(err, rows, fields) {
                if (err) {
                    console.log(err);
                }
            })
        } else {
            db.query(`UPDATE dog SET dog_name_1='${dogNames[0]}', dog_name_2='${dogNames[1]}', dog_name_3='${dogNames[2]}' WHERE id='${res.locals.userId}'`, function(err, rows, fields) {
                if (err) {
                    console.log(err);
                }
            })
        }
    })
    res.send('Success');
})

app.post('/delete-dog', checkUser, function (req, res) {
    const { idx } = req.body;

    // delete dog name
    db.query(`SELECT name, id FROM user WHERE id='${res.locals.userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('Nothing');
            return;
        }

        const dogName = `dog_name_${idx + 1}`;
        db.query(`UPDATE dog SET ${dogName}='' WHERE id='${res.locals.userId}'`, function(err, rows, fields) {
            res.send('Success');
        })
    })
})

// Mypage - withdrawal
app.post('/withdrawal', checkUser, function (req, res) {
    const { userPw } = req.body;

    db.query(`SELECT * FROM user WHERE id='${res.locals.userId}'`, async function(err, rows, fields) {
        if (!await argon2.verify(rows[0].pw, userPw)) {
            res.send('Fail');
            return;
        }
    })

    // data
    const tables = ['diary', 'dog', 'user'];
    tables.forEach((table) => {
        db.query(`SELECT * FROM ${table} WHERE id='${res.locals.userId}'`, function(err, rows, fields) {
            if (rows.length !== 0) {
                db.query(`DELETE FROM ${table} WHERE id='${res.locals.userId}'`, function(err, rows, fields) {
                    if (err) {
                        throw err;
                    }
                })
            }
        })
    })
    res.clearCookie('access_token');
    res.send('Success');

    // image
    const directory = `./uploads/${res.locals.userId}`;
    const isTrue = fs.existsSync(directory);
    if (isTrue) {
        fs.rmSync(directory , { recursive: true });
    }
})

// Mypage - logout
app.get('/logout', checkUser, function (req, res) {
    res.clearCookie('access_token');
    res.send('Success');
})

// WriteDiary
app.get('/get-dogs', checkUser, function (req, res) {
    // get dog names
    db.query(`SELECT * FROM dog WHERE id='${res.locals.userId}'`, function(err, rows, fields) {
        if (rows.length === 0) {
            res.send('Nothing');
            return;
        }
        const data = rows[0];
        delete data.id;
        res.send(data);
    })
})

app.post('/write-diary', checkUser, upload.single('img'), (req, res, next) => {
    const { date, weather, selectedDog, title, content } = JSON.parse(req.body.info);

    // data
    const fileName = `${req.file.filename}${path.extname(req.file.originalname)}`

    db.query(`INSERT INTO diary(id, date, weather, dog_name, title, content, image_name)
        VALUES('${res.locals.userId}', '${date.join(' ')}', '${weather}', '${selectedDog}', '${title}', '${content}', '${fileName}')`, 
        (err, rows, fields) => {
        if (err) {
            console.log(err);
            return;
        }
        res.send(fileName);
    })
    
    // image
    const directory = `./uploads/${res.locals.userId}`;
    const isTrue = fs.existsSync(directory);
    if (!isTrue) {
            fs.mkdirSync(directory);
    }

    fs.rename(`./uploads/${req.file.filename}`, `./uploads/${res.locals.userId}/${fileName}`, function(err) {
        if (err) {
            console.log(err);
        }
    })
})


// MyDiary
    // basic cards
app.post('/diaries', checkUser, (req, res) => {
    // data
    const { order } = req.body;
    const getCards = (option) => {
        const resArr = [];

        db.query(`SELECT * FROM diary WHERE id='${res.locals.userId}' AND starred=${1}`, (err, rows, fields) => {
            if (rows.length === 0) {
                resArr.push('Nothing');
            } else {
                resArr.push(rows);
            }

            db.query(`SELECT * FROM diary WHERE id='${res.locals.userId}' ${option} LIMIT 9`, (err, rows, fields) => {
                if (rows.length === 0) {
                    resArr.push('Nothing');
                } else {
                    resArr.push(rows);
                }
                res.send(resArr);
            })
        })
    }

    switch(order) { 
        case '최신 순서': case undefined:
            getCards('ORDER BY date DESC');
            break;
        case '오래된 순서':
            getCards('ORDER BY date ASC');
            break;
        default:
            getCards(`AND dog_name='${order}'`);
    }
})

    // more cards
app.post('/more-diaries', checkUser, (req, res) => {
    // data
    const { share, order } = req.body;
    const getCards = (option) => {
        db.query(`SELECT * FROM diary WHERE id='${res.locals.userId}' ${option} LIMIT ${share * 9}, 9`, (err, rows, fields) => {
        if (rows.length === 0) {
            res.send('Nothing');
            return;
        }
        res.send(rows);
        })
    }

    switch(order) {
        case '최신 순서': case undefined:
            getCards('ORDER BY date DESC');
            break;
        case '오래된 순서':
            getCards('ORDER BY date ASC');
            break;
        default:
            getCards(`AND dog_name='${order}'`);
    }
})

app.post('/order', checkUser, (req, res) => {
    // data
    const { order } = req.body;
    const getCards = (option) => {
        db.query(`SELECT * FROM diary WHERE id='${res.locals.userId}' ${option} LIMIT 9`, (err, rows, fields) => {
        if (rows.length === 0) {
            res.send('Nothing');
            return;
        }
        res.send(rows);
        })
    }

    switch(order) {
        case '최신 순서':
            getCards('ORDER BY date DESC');
            break;
        case '오래된 순서':
            getCards('ORDER BY date ASC');
            break;
        default:
            getCards(`AND dog_name='${order}'`);
    }
})

// DetailedDiary
app.post('/get-diary', checkUser, (req, res) => {
    // data
    const { imageName } = req.body;
    db.query(`SELECT * FROM diary WHERE id='${res.locals.userId}' AND image_name='${imageName}'`, (err, rows, fields) => {
        res.send(rows[0]);
    })
})

app.post('/update-diary', checkUser, upload.single('img'), (req, res, next) => {
    const reqArr = [];
    if (req.body.info) {
        reqArr.push(JSON.parse(req.body.info));
    } else {
        reqArr.push(req.body);
    }

    // data
    const { weather, dogName, title, content, imageName } = reqArr[0];

    db.query(`SELECT dog_name, image_name FROM diary WHERE id='${res.locals.userId}' AND image_name='${imageName}'`, (err, rows, fields) => {
        if (rows.length === 0) {
            return;
        }

        const newfileName = [];
        if (req.file === undefined) {
            newfileName.push('');
        } else {
            newfileName.push(`${req.file.filename}${path.extname(req.file.originalname)}`);
        }

        db.query(`UPDATE diary SET weather='${weather}', title='${title}', content='${content}', dog_name='${dogName}'
        ${newfileName[0] === '' ? '' : `, image_name='${newfileName[0]}'`} WHERE id='${res.locals.userId}' AND image_name='${imageName}'`,
        async function (err, rows, fields) {
            if (err) {
                console.error(err);
                return;
            }

            // image
            if (newfileName[0] === '') {
                res.send(imageName);
                return;
            }
            await fsPromises.unlink(`./uploads/${res.locals.userId}/${imageName}`);
            await fsPromises.rename(`./uploads/${req.file.filename}`, `./uploads/${res.locals.userId}/${newfileName[0]}`);
            res.send(newfileName[0]);
        })
    })
})

app.post('/delete-diary', checkUser, (req, res) => {
    // data
    const { imageName } = req.body;
    db.query(`DELETE FROM diary WHERE id='${res.locals.userId}' AND image_name='${imageName}'`, async function(err, rows, fields) {
        await fsPromises.unlink(`./uploads/${res.locals.userId}/${imageName}`);
        res.send('Success');
    })
})

app.post('/starred', checkUser, (req, res) => {
    // data
    const { starred, imageName } = req.body;
    db.query(`UPDATE diary SET starred='${starred}' WHERE id='${res.locals.userId}' AND image_name='${imageName}'`, (err, rows, fields) => {
        if (err) {
            console.error(err);
            return;
        }
        res.send('Success');
    })
})


app.listen(3001, () => {
    console.log('Server is running!');
});
// 8080
