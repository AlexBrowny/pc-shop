import {
  html, $, api, toast, errorText, ApiError, flattenErrors,
} from '/admin/common.js';

export async function settingsView(main) {
  const s = await api('/settings');
  const v = s.values;

  main.innerHTML = html`
    <div class="two-col">
      <section class="card pad">
        <h2>Telegram-бот</h2>
        <p>
          Токен бота: ${s.telegram.tokenConfigured
            ? html`<span class="badge paid">задан</span>`
            : html`<span class="badge cancelled">не задан</span>`}
          <span class="muted small">— хранится только в переменной окружения <code>TELEGRAM_BOT_TOKEN</code> (файл <code>.env</code>) и здесь не показывается.</span>
        </p>
        <form id="tg-form" class="form" novalidate>
          <label class="field"><span>Chat ID менеджера</span>
            <input name="telegram_chat_id" value="${v.telegram_chat_id || s.telegram.chatId}" placeholder="например, 123456789 или -1001234567890" autocomplete="off"></label>
          <ol class="muted small steps">
            <li>Создайте бота у @BotFather и вставьте токен в <code>.env</code>.</li>
            <li>Менеджер открывает бота и нажимает «Start» (для группы — добавьте бота в группу).</li>
            <li>Узнайте Chat ID командой <code>npm run telegram:chat-id</code> и впишите сюда.</li>
          </ol>
          <ul id="tg-errors" class="form-error" hidden></ul>
          <div class="form-actions">
            <button type="button" class="btn" id="tg-test">Отправить тестовое сообщение</button>
            <button class="btn primary" type="submit">Сохранить</button>
          </div>
        </form>
      </section>

      <section class="card pad">
        <h2>Реквизиты для оплаты</h2>
        <p class="muted small">Показываются покупателю на странице оформления заказа.</p>
        <form id="pay-form" class="form" novalidate>
          <label class="field"><span>Номер карты</span><input name="payment_card" value="${v.payment_card || s.defaults.payment_card}" maxlength="40"></label>
          <label class="field"><span>Получатель</span><input name="payment_holder" value="${v.payment_holder || s.defaults.payment_holder}" maxlength="80"></label>
          <label class="field"><span>Примечание (русский)</span><textarea name="payment_note_ru" rows="2" maxlength="300">${v.payment_note_ru}</textarea></label>
          <label class="field"><span>Примечание (узбекский)</span><textarea name="payment_note_uz" rows="2" maxlength="300">${v.payment_note_uz}</textarea></label>
          <ul id="pay-errors" class="form-error" hidden></ul>
          <div class="form-actions"><button class="btn primary" type="submit">Сохранить</button></div>
        </form>
      </section>
    </div>`.toString();

  const bind = (formId, errorsId) => {
    const formEl = $(formId, main);
    formEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      const json = Object.fromEntries(new FormData(formEl));
      const box = $(errorsId, main);
      box.hidden = true;
      try {
        await api('/settings', { method: 'PUT', json });
        toast('Сохранено');
      } catch (err) {
        const lines = err instanceof ApiError ? (Object.keys(err.fields).length ? flattenErrors(err.fields) : [errorText(err.code)]) : ['Ошибка соединения'];
        box.textContent = lines.join('; ');
        box.hidden = false;
      }
    });
  };
  bind('#tg-form', '#tg-errors');
  bind('#pay-form', '#pay-errors');

  $('#tg-test', main).addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const result = await api('/telegram/test', { method: 'POST', json: {} });
      if (result.status === 'sent') toast('Тестовое сообщение отправлено');
      else if (result.status === 'disabled') toast('Укажите токен в .env и Chat ID', 'err');
      else toast(result.error ?? 'Ошибка Telegram', 'err');
    } catch {
      toast('Ошибка соединения', 'err');
    } finally {
      e.target.disabled = false;
    }
  });
  return null;
}
