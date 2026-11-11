import { html, $, toast } from '../util.js';
import {
  t, fmtPrice, specRows, categoryName, getLang,
} from '../i18n.js';
import {
  getProduct, getCategories, getReviews, saveReview, deleteReview,
} from '../api.js';
import { parseHash, actions, go } from '../router.js';
import { icons } from '../icons.js';
import { getUser } from '../store.js';
import { stars, compareButton, isPhoto } from '../components.js';

const ui = { slug: '', rating: 0 };

const fmtDate = (iso) => new Date(iso).toLocaleDateString(getLang() === 'uz' ? 'uz-UZ' : 'ru-RU', { dateStyle: 'medium' });

function galleryHtml(product) {
  const photos = [product.image, ...(product.images ?? []).map((i) => i.url)];
  return html`
    <div class="pg ${photos.length > 1 ? '' : 'single'}" id="pg">
      ${photos.length > 1 ? html`
        <div class="pg-thumbs" role="list" aria-label="${t('product.gallery')}">
          ${photos.map((src, i) => html`<button type="button" class="pg-thumb ${isPhoto(src) ? 'is-photo' : ''} ${i === 0 ? 'active' : ''}" data-action="gallery-pick" data-src="${src}" aria-label="${t('product.gallery')} ${i + 1}"><img src="${src}" alt="" loading="lazy"></button>`)}
        </div>` : ''}
      <div class="pg-main ${isPhoto(photos[0]) ? 'is-photo' : ''}" id="pg-main"><img id="gallery-main" src="${photos[0]}" alt="${product.brand} ${product.name}"></div>
      ${product.image_kind === 'render' ? html`<p class="pg-note muted small">${t('product.render_note')}</p>` : ''}
    </div>`;
}

function ratingSummary(summary) {
  if (!summary.count) return html`<p class="muted">${t('reviews.none')}</p>`;
  const max = Math.max(...summary.dist, 1);
  return html`
    <div class="rv-summary">
      <div class="rv-score"><b>${summary.avg.toFixed(1)}</b>${stars(summary.avg, 18)}<small class="muted">${t('reviews.count', { n: summary.count })}</small></div>
      <div class="rv-dist">
        ${[5, 4, 3, 2, 1].map((n) => html`<div><span>${n}★</span><i style="--w:${(summary.dist[n - 1] / max) * 100}%"></i><small class="muted">${summary.dist[n - 1]}</small></div>`)}
      </div>
    </div>`;
}

function reviewForm(mine) {
  ui.rating = mine?.rating ?? 0;
  return html`
    <form id="rv-form" class="card rv-form" novalidate>
      <h3>${t('reviews.write')}</h3>
      <div class="rv-pick" role="radiogroup" aria-label="${t('reviews.your_rating')}">
        ${[1, 2, 3, 4, 5].map((n) => html`<button type="button" class="rv-star ${n <= ui.rating ? 'on' : ''}" data-action="rv-rate" data-n="${n}" role="radio" aria-checked="${n === ui.rating}" aria-label="${n}">★</button>`)}
      </div>
      <textarea name="body" rows="3" maxlength="1500" placeholder="${t('reviews.text_ph')}">${mine?.body ?? ''}</textarea>
      <p id="rv-error" class="form-error" role="alert" hidden></p>
      <div class="rv-actions">
        <button type="submit" class="btn btn-primary btn-sm">${mine ? t('reviews.update') : t('reviews.submit')}</button>
        ${mine ? html`<button type="button" class="btn btn-ghost btn-sm" data-action="rv-delete">${icons.trash} ${t('reviews.delete')}</button>` : ''}
      </div>
    </form>`;
}

function reviewsHtml(data) {
  const mine = data.items.find((r) => r.mine);
  const others = data.items.filter((r) => !r.mine);
  return html`
    ${ratingSummary(data.summary)}
    ${getUser()
    ? reviewForm(mine)
    : html`<p class="rv-login"><a class="btn btn-sm" href="#/login?next=/product/${ui.slug}">${t('reviews.login')}</a></p>`}
    <ul class="rv-list">
      ${[...(mine ? [mine] : []), ...others].map((r) => html`
        <li class="card rv-item ${r.hidden ? 'dim' : ''}">
          <div class="rv-head">
            <strong>${r.author}</strong>${r.verified ? html`<span class="status-pill st-paid">${icons.check} ${t('reviews.verified')}</span>` : ''}
            ${stars(r.rating)}<span class="muted small">${fmtDate(r.created_at)}</span>
            ${r.hidden ? html`<span class="muted small">(${t('reviews.hidden')})</span>` : ''}
          </div>
          ${r.body ? html`<p class="rv-text">${r.body}</p>` : ''}
        </li>`)}
    </ul>`;
}

async function refreshReviews() {
  const box = $('#reviews-box');
  if (!box) return;
  try {
    box.innerHTML = reviewsHtml(await getReviews(ui.slug)).toString();
  } catch {
    box.innerHTML = html`<p class="muted">${t('common.error')}</p>`.toString();
  }
}

export const productPage = {
  async render() {
    const slug = parseHash().path.split('/')[2];
    ui.slug = slug;
    let product;
    try {
      product = await getProduct(slug);
    } catch {
      return html`<div class="empty">${t('product.not_found')} <a href="#/catalog">${t('cart.go_catalog')}</a></div>`;
    }
    const cat = (await getCategories()).find((c) => c.key === product.category);

    return html`
      <nav class="crumbs"><a href="#/catalog">${t('catalog.title')}</a> / <a href="#/catalog?cat=${product.category}">${categoryName(cat)}</a></nav>
      <div class="product">
        ${galleryHtml(product)}
        <div class="product-info">
          <div class="brand">${product.brand}</div>
          <h1>${product.name}</h1>
          ${product.rating_count ? html`<a class="pr-rating" href="#/product/${slug}" data-action="scroll-reviews">${stars(product.rating_avg, 16)} <b>${product.rating_avg.toFixed(1)}</b> <span class="muted">${t('reviews.count', { n: product.rating_count })}</span></a>` : ''}
          <div class="price price-lg">${fmtPrice(product.price_uzs)}</div>
          <p class="stock-line">${product.stock > 0 ? html`${icons.check} ${t('common.stock_n', { n: product.stock })}` : ''}</p>
          <div class="actions">
            <button class="btn btn-primary" data-action="cart-add" data-id="${product.id}">${icons.cart} ${t('common.add_to_cart')}</button>
            <button class="btn btn-ghost" data-action="to-builder" data-id="${product.id}" data-category="${product.category}">${icons.cube} ${t('product.to_builder')}</button>
            ${compareButton(product)}
          </div>
          <h3>${t('common.specs')}</h3>
          <table class="spec-table"><tbody>
            ${specRows(product).map((r) => html`<tr><th>${r.label}</th><td>${r.value}</td></tr>`)}
          </tbody></table>
        </div>
      </div>
      <section class="reviews" id="reviews">
        <h2>${t('reviews.title')}</h2>
        <div id="reviews-box"><div class="skeleton" style="height:90px"></div></div>
      </section>`;
  },

  mount() {
    refreshReviews();
  },
};

actions['gallery-pick'] = (el) => {
  $('#gallery-main').src = el.dataset.src;
  $('#pg-main').classList.toggle('is-photo', isPhoto(el.dataset.src));
  $('#pg-main').classList.remove('zoom');
  document.querySelectorAll('.pg-thumb').forEach((b) => b.classList.toggle('active', b === el));
};

// увеличение настоящего фото при наведении: точка под курсором остаётся в центре увеличения
document.addEventListener('mousemove', (e) => {
  const box = e.target.closest?.('.pg-main.is-photo');
  if (!box) return;
  const r = box.getBoundingClientRect();
  const img = box.querySelector('img');
  img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  box.classList.add('zoom');
});
document.addEventListener('mouseout', (e) => {
  const box = e.target.closest?.('.pg-main');
  if (box && !box.contains(e.relatedTarget)) box.classList.remove('zoom');
});

actions['scroll-reviews'] = (_el, e) => {
  e.preventDefault();
  $('#reviews')?.scrollIntoView({ behavior: 'smooth' });
};

actions['rv-rate'] = (el) => {
  ui.rating = Number(el.dataset.n);
  document.querySelectorAll('.rv-star').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.n) <= ui.rating);
    b.setAttribute('aria-checked', String(Number(b.dataset.n) === ui.rating));
  });
};

actions['rv-delete'] = async () => {
  try {
    await deleteReview(ui.slug);
    await refreshReviews();
  } catch { toast(t('common.error')); }
};

// отправка формы отзыва (форма создаётся динамически, поэтому слушаем на документе)
document.addEventListener('submit', async (event) => {
  if (event.target.id !== 'rv-form') return;
  event.preventDefault();
  const errBox = $('#rv-error');
  const show = (msg) => { errBox.textContent = msg; errBox.hidden = !msg; };
  show('');
  if (!ui.rating) return show(t('reviews.pick_rating'));
  try {
    await saveReview(ui.slug, ui.rating, new FormData(event.target).get('body') ?? '');
    toast(t('reviews.saved'));
    await refreshReviews();
  } catch (err) {
    if (err.code === 'unauthorized') return go(`/login?next=/product/${ui.slug}`);
    const key = `err.${err.code}`;
    return show(t(key) !== key ? t(key) : t('common.error'));
  }
  return undefined;
});
