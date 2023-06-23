module.exports = function (req, res, con, next) {
    // Выводим значения кук в консоль для отладки
    console.log(req.cookies);
    console.log(req.cookies.hash);
    console.log(req.cookies.id);

    // Проверяем, есть ли значения кук hash и id
    if (req.cookies.hash == undefined || req.cookies.id == undefined) {
        // Если одно из значений отсутствует, перенаправляем пользователя на страницу входа в систему администратора
        res.redirect('/login');
        return false; // Возвращаем false, чтобы прервать выполнение middleware
    }

    // Если значения кук присутствуют, делаем запрос к базе данных для проверки аутентификации пользователя
    con.query(
        'SELECT * FROM user WHERE id=' + req.cookies.id + ' and hash="' + req.cookies.hash + '"',
        function (error, result) {
            if (error) reject(error);

            // Выводим результат запроса в консоль для отладки
            console.log(result);

            // Проверяем результат запроса
            if (result.length == 0) {
                // Если запись не найдена, выводим сообщение об ошибке в консоль и перенаправляем пользователя на страницу входа в систему администратора
                console.log('error user not found');
                res.redirect('/login');
            } else {
                // Если запись найдена, передаем управление следующему middleware или маршруту
                next();
            }
        });
}
