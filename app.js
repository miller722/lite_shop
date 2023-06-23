
// Подключение модулей:
// express: основной модуль Express.js для создания веб-приложения.
// cookie-parser: модуль для работы с куками (парсинг, установка, чтение).
// admin: модуль (файл) с обработчиками маршрутов для административного раздела.
// mysql: модуль для взаимодействия с базой данных MySQL.
// nodemailer: модуль для отправки электронной почты.

let express = require('express');
let app = express();
let cookieParser = require('cookie-parser');
let admin = require('./admin');

/**
 * public - имя папки где хранится статика
 */
app.use(express.static('public'));
/**
 *  задаем шаблонизатор
 */
app.set('view engine', 'pug');
/**
* Подключаем mysql модуль
*/
let mysql = require('mysql');
/**
* настраиваем модуль
*/

// Middleware:
app.use(express.json()); // middleware для обработки JSON-данных в теле запроса.
app.use(express.urlencoded()); // middleware для обработки данных формы в теле запроса.
app.use(cookieParser()); // middleware для обработки кук (парсинг, установка, чтение).

const nodemailer = require('nodemailer');

let con = mysql.createConnection({
  host: 'localhost',
  user: 'miller',
  password: 'root',
  database: 'lite_shop'
});

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;


app.listen(3000, function () {
  console.log('node express work on 3000');
});

app.use(function (req, res, next) {
  if (req.originalUrl == '/admin' || req.originalUrl == '/admin-order') {
    admin(req, res, con, next);
  }
  else {
    next();
  }
});

// Маршруты:
// '/': главная страница. Выполняется запрос к базе данных для получения данных о товарах и категориях. Затем данные передаются в шаблон и рендерятся на странице.
app.get('/', function (req, res) {
  let cat = new Promise(function (resolve, reject) {
    con.query(
      "select id, slug, name, cost, image, category from (select id, slug, name,cost,image,category, if(if(@curr_category != category, @curr_category := category, '') != '', @k := 0, @k := @k + 1) as ind   from goods, ( select @curr_category := '' ) v ) goods where ind < 3",
      function (error, result, field) {
        if (error) return reject(error);
        resolve(result);
      }
    );
  });
  let catDescription = new Promise(function (resolve, reject) {
    con.query(
      "SELECT * FROM category",
      function (error, result, field) {
        if (error) return reject(error);
        resolve(result);
      }
    );
  });
  Promise.all([cat, catDescription]).then(function (value) {
    console.log(value[1]);
    res.render('index', {
      goods: JSON.parse(JSON.stringify(value[0])),
      cat: JSON.parse(JSON.stringify(value[1])),
    });
  });
});

// '/cat': страница категории товаров. Выполняется запрос к базе данных для получения данных о категории и товарах в этой категории. Затем данные передаются в шаблон и рендерятся на странице.
app.get('/cat', function (req, res) {
  console.log(req.query.id);
  let catId = req.query.id;

  let cat = new Promise(function (resolve, reject) {
    con.query(
      'SELECT * FROM category WHERE id=' + catId,
      function (error, result) {
        if (error) reject(error);
        resolve(result);
      });
  });
  let goods = new Promise(function (resolve, reject) {
    con.query(
      'SELECT * FROM goods WHERE category=' + catId,
      function (error, result) {
        if (error) reject(error);
        resolve(result);
      });
  });

  Promise.all([cat, goods]).then(function (value) {
    console.log(value[0]);
    res.render('cat', {
      cat: JSON.parse(JSON.stringify(value[0])),
      goods: JSON.parse(JSON.stringify(value[1]))
    });
  })
});

//'/goods/*': страница конкретного товара. Выполняется запрос к базе данных для получения данных о товаре по его слагу (идентификатору). Затем данные передаются в шаблон и рендерятся на странице.
app.get('/goods/*', function (req, res) {
  console.log('work');
  console.log(req.params);
  con.query('SELECT * FROM goods WHERE slug="' + req.params['0'] + '"', function (error, result, fields) {
    if (error) throw error;
    console.log(result);
    res.render('goods', { goods: JSON.parse(JSON.stringify(result)) });
  });
});

//'/order': страница оформления заказа. Рендерится соответствующий шаблон.
app.get('/order', function (req, res) {
  res.render('order');
});

//'/get-category-list': обработчик POST-запроса для получения списка категорий товаров из базы данных. Отправляет ответ в формате JSON с данными о категориях.
app.post('/get-category-list', function (req, res) {
  // console.log(req.body);
  con.query('SELECT id, category FROM category', function (error, result, fields) {
    if (error) throw error;
    console.log(result)
    res.json(result);
  });
});

//'/get-goods-info': обработчик POST-запроса для получения информации о выбранных товарах из базы данных. Отправляет ответ в формате JSON с данными о товарах.
app.post('/get-goods-info', function (req, res) {
  console.log(req.body.key);
  if (req.body.key.length != 0) {
    con.query('SELECT id,name,cost FROM goods WHERE id IN (' + req.body.key.join(',') + ')', function (error, result, fields) {
      if (error) throw error;
      console.log(result);
      let goods = {};
      for (let i = 0; i < result.length; i++) {
        goods[result[i]['id']] = result[i];
      }
      res.json(goods);
    });
  }
  else {
    res.send('0');
  }
});

//'/finish-order': обработчик POST-запроса для сохранения заказа в базе данных и отправки подтверждения на указанный адрес электронной почты.
app.post('/finish-order', function (req, res) {
  console.log(req.body);
  if (req.body.key.length != 0) {
    let key = Object.keys(req.body.key);
    con.query(
      'SELECT id,name,cost FROM goods WHERE id IN (' + key.join(',') + ')',
      function (error, result, fields) {
        if (error) throw error;
        console.log(result);
        sendMail(req.body, result).catch(console.error);
        saveOrder(req.body, result);
        res.send('1');
      });
  }
  else {
    res.send('0');
  }
});

//'/admin': страница администратора. Рендерится соответствующий шаблон.
app.get('/admin', function (req, res) {
  res.render('admin', {});
});

//'/admin-order': страница заказов администратора. Выполняется запрос к базе данных для получения списка заказов. Затем данные передаются в шаблон и рендерятся на странице.
app.get('/admin-order', function (req, res) {
  con.query(`SELECT 
      shop_order.id as id,
      shop_order.user_id as user_id,
        shop_order.goods_id as goods_id,
        shop_order.goods_cost as goods_cost,
        shop_order.goods_amount as goods_amount,
        shop_order.total as total,
        from_unixtime(date,"%Y-%m-%d %h:%m") as human_date,
        user_info.user_name as user,
        user_info.user_phone as phone,
        user_info.address as address
    FROM 
      shop_order
    LEFT JOIN	
      user_info
    ON shop_order.user_id = user_info.id ORDER BY id DESC`, function (error, result, fields) {
      if (error) throw error;
      console.log(result);
      res.render('admin-order', { order: JSON.parse(JSON.stringify(result)) });
    });
});

/**
 *  login form ==============================
 * '/login': страница входа в систему администратора. Рендерится соответствующий шаблон. При отправке формы происходит проверка логина и пароля в базе данных и установка куки для аутентификации.
 */
app.get('/login', function (req, res) {
  res.render('login', {});
});

app.post('/login', function (req, res) {
  console.log('=======================');
  console.log(req.body);
  console.log(req.body.login);
  console.log(req.body.password);
  console.log('=======================');
  con.query(
    'SELECT * FROM user WHERE login="' + req.body.login + '" and password="' + req.body.password + '"',
    function (error, result) {
      if (error) reject(error);
      console.log(result);
      console.log(result.length);
      if (result.length == 0) {
        console.log('error user not found');
        res.redirect('/login');
      }
      else {
        result = JSON.parse(JSON.stringify(result));
        let hash = makeHash(32);
        res.cookie('hash', hash);
        res.cookie('id', result[0]['id']);
        /**
         * write hash to db
         */
        sql = "UPDATE user  SET hash='" + hash + "' WHERE id=" + result[0]['id'];
        con.query(sql, function (error, resultQuery) {
          if (error) throw error;
          res.redirect('/admin');
        });


      };
    });
});

// сохранение информации о заказе и товарах в базе данных.
function saveOrder(data, result) {
  // data - информация о пользователе
  // result - сведения о товаре
  let sql;
  sql = "INSERT INTO user_info (user_name, user_phone, user_email, address) VALUES ('" + data.username + "','" + data.phone + "','" + data.email + "','" + data.address + "')";
  con.query(sql, function (error, resultQuery) {
    if (error) throw error;
    console.log('1 user info saved');
    console.log(resultQuery);
    let userId = resultQuery.insertId;
    date = new Date() / 1000;
    for (let i = 0; i < result.length; i++) {
      sql = "INSERT INTO shop_order(date, user_id, goods_id,goods_cost, goods_amount, total) VALUES (" + date + "," + userId + "," + result[i]['id'] + "," + result[i]['cost'] + "," + data.key[result[i]['id']] + "," + data.key[result[i]['id']] * result[i]['cost'] + ")";
      con.query(sql, function (error, resultQuery) {
        if (error) throw error;
        console.log("1 goods saved");
      })
    }
  });

}

// отправка подтверждения заказа на указанный адрес электронной почты с использованием модуля nodemailer.
async function sendMail(data, result) {
  let res = '<h2>Order in lite shop</h2>';
  let total = 0;
  for (let i = 0; i < result.length; i++) {
    res += `<p>${result[i]['name']} - ${data.key[result[i]['id']]} - ${result[i]['cost'] * data.key[result[i]['id']]} uah</p>`;
    total += result[i]['cost'] * data.key[result[i]['id']];
  }
  console.log(res);
  res += '<hr>';
  res += `Total ${total} uah`;
  res += `<hr>Phone: ${data.phone}`;
  res += `<hr>Username: ${data.username}`;
  res += `<hr>Address: ${data.address}`;
  res += `<hr>Email: ${data.email}`;

  let testAccount = await nodemailer.createTestAccount();

  let transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: testAccount.user, // generated ethereal user
      pass: testAccount.pass // generated ethereal password
    }
  });

  let mailOption = {
    from: '<luschenko@gmail.com>',
    to: "luschenko@gmail.com," + data.email,
    subject: "Lite shop order",
    text: 'Hello world',
    html: res
  };

  let info = await transporter.sendMail(mailOption);
  console.log("MessageSent: %s", info.messageId);
  console.log("PreviewSent: %s", nodemailer.getTestMessageUrl(info));
  return true;
}

// генерация случайного хеша указанной длины.
  function makeHash(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
