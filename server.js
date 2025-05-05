const express = require("express");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");
const path = require("path");

const serviceAccount = require("./serviceAccountKey.json");


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // databaseURL: "https://shopcurs-5dbd4.firebaseio.com" // не обязательно для FCM
});

const app = express();
app.use(bodyParser.json());

// Используем порт из переменной окружения или 3000 по умолчанию
const PORT = process.env.PORT || 3000;

// ==== PUSH NOTIFICATION API ====

// POST /change_supplier_status
// body: { userId, newStatus }
app.post("/change_supplier_status", async (req, res) => {
  try {
    const { userId, newStatus } = req.body;

    if (!userId || !newStatus) {
      return res.status(400).json({ error: "userId и newStatus обязательны." });
    }

    // 1. Обновляем статус в Firestore
    // Найди заявку, где user_id = userId
    const appsRef = admin.firestore().collection("supplier_applications");
    const query = await appsRef.where("user_id", "==", userId).limit(1).get();
    if (query.empty) return res.status(404).json({ error: "Заявка не найдена" });
    const doc = query.docs[0];
    await doc.ref.update({ status: newStatus });

    // 2. Обновляем роль пользователя если нужно
    if (newStatus === "approved") {
      await admin.firestore().collection("users").doc(userId).update({ role: "Supplier" });
    }

    // 3. Получаем push_token пользователя
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    const pushToken = userDoc.get("push_token");

    // 4. Отправляем пуш
    if (pushToken) {
      let title, body;
      if (newStatus === "approved") {
        title = "Ваша заявка одобрена!";
        body = "Поздравляем, вы стали поставщиком!";
      } else if (newStatus === "rejected") {
        title = "Ваша заявка отклонена";
        body = "К сожалению, ваша заявка не прошла модерацию.";
      } else {
        title = "Статус вашей заявки обновлён";
        body = "Проверьте статус в приложении.";
      }

      const message = {
        token: pushToken,
        notification: { title, body },
        data: { status: newStatus },
      };

      await admin.messaging().send(message);
      console.log(`Push sent to ${userId}: ${title}`);
    } else {
      console.log(`Нет push_token для пользователя ${userId}`);
    }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ==== ОСТАВЛЯЕМ ТВОЙ REDIRECT ====

app.get("/product_redirect", (req, res) => {
  const productId = req.query.productId;

  if (!productId) {
    return res.status(400).send("Product ID is required.");
  }

  const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Открыть товар в приложении</title>
      <meta property="og:title" content="Смотрите товар в приложении Shop" />
      <meta property="og:description" content="Откройте этот товар в нашем приложении или скачайте его бесплатно!" />
      <meta property="og:url" content="https://${req.headers.host}/product_redirect?productId=${productId}" />
      <meta property="og:type" content="website" />
      <meta name="theme-color" content="#3D74FF">
      <style>
        html, body { height: 100%; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          background: #f7f7f7; color: #222; min-height: 100vh;
        }
        .container {
          max-width: 420px; margin: 40px auto; padding: 24px 16px 30px 16px;
          background: #fff; border-radius: 14px; box-shadow: 0 4px 24px #0001; text-align: center;
        }
        h2 { color: #3D74FF; margin-bottom: 18px; }
        .btn {
          display: block; width: 100%; padding: 15px 0; background: #3D74FF; color: #fff;
          border-radius: 8px; text-decoration: none; font-size: 17px; font-weight: bold;
          margin-top: 8px; margin-bottom: 16px; transition: background 0.2s;
        }
        .btn:active, .btn:hover { background: #2659c8; }
        .sub { color: #555; font-size: 15px; margin-bottom: 18px; }
        a { color: #3D74FF; text-decoration: underline; }
        @media (max-width: 480px) {
          .container { margin: 0; min-height: 100vh; border-radius: 0; }
          h2 { font-size: 1.4em; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Открыть товар в приложении</h2>
        <div class="sub">
          Если у вас установлено наше приложение,<br>
          нажмите кнопку ниже:
        </div>
        <a class="btn" id="openAppBtn" href="myapp://product?productId=${productId}">Открыть в приложении</a>
        <div class="sub">
          Если приложение не открывается, скачайте его бесплатно:
        </div>
        <a class="btn" href="https://play.google.com/store/apps/details?id=com.example.shop" style="background:#26b246;">Скачать приложение</a>
        <div style="color:#aaa;font-size:13px;margin-top:18px;">
          Если ничего не происходит,<br>откройте эту страницу в браузере.<br><br>
          <span style="font-size:12px;">© Shop App</span>
        </div>
      </div>
      <script>
        function isIOS() {
          return /iphone|ipad|ipod/i.test(navigator.userAgent);
        }
        var productId = "${productId}";
        var deepLink = "myapp://product?productId=" + productId;
        if (!isIOS()) {
          setTimeout(function() { window.location = deepLink; }, 450);
          setTimeout(function() { window.location = "https://play.google.com/store/apps/details?id=com.example.shop"; }, 2200);
        }
        document.getElementById("openAppBtn").onclick = function(e) {
          if (!isIOS()) {
            window.location = deepLink;
            setTimeout(function() {
              window.location = "https://play.google.com/store/apps/details?id=com.example.shop";
            }, 1800);
          }
        };
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

// ==== Запуск сервера ====
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});