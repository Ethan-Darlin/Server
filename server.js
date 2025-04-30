const express = require("express");
const app = express();
const PORT = 3000; // Укажите порт для сервера

// Маршрут для перенаправления
app.get("/product_redirect", (req, res) => {
  const productId = req.query.productId; // Получаем productId из параметров запроса
  
  if (!productId) {
    // Если productId не указан, возвращаем ошибку
    return res.status(400).send("Product ID is required.");
  }

  // HTML-страница для редиректа
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redirecting...</title>
      <script>
        window.onload = function() {
          // Попытка открыть приложение через глубокую ссылку
          window.location = "myapp://product?productId=${productId}";

          // Если приложение не установлено, через 2 секунды перенаправляем на магазин
          setTimeout(function() {
            window.location = "https://play.google.com/store/apps/details?id=com.example.shop";
          }, 2000);
        };
      </script>
    </head>
    <body>
      <h1>Redirecting...</h1>
      <p>If you are not redirected automatically, <a href="myapp://product?productId=${productId}">click here to open the app</a>.</p>
      <p>Or <a href="https://play.google.com/store/apps/details?id=com.example.shop">download the app</a>.</p>
    </body>
    </html>
  `;

  // Отправляем HTML-страницу
  res.send(html);
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Redirect server is running on http://localhost:${PORT}`);
});