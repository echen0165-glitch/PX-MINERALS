import '/app/favicon.js';

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
let dashboard;
let offers = [];
let activeTerm = 'short';
let depositAmounts = [];
let waveCheckoutUrl = '';
let bonusData;
let referralData;
let notificationsData;
let documentsData;
let ticketsData;
let selectedTicketId;

const $ = (selector) => document.querySelector(selector);
const initials = (name = 'PX') => name.split(/\s+/).map((item) => item[0]).join('').slice(0, 2).toUpperCase();
const formatMoney = (value) => money.format(Number(value ?? 0)).replace('FCFA', 'FCFA');
const formatDate = (value) => value ? date.format(new Date(value)) : '—';
const escape = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[c]);

async function request(url) {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (response.status === 401) { window.location.replace('/app/login.html'); throw new Error('Session requise'); }
  if (!response.ok) throw new Error('Impossible de charger vos données.');
  return response.json();
}

function investmentProgress(item) { return Math.max(0, Math.min(100, ((Date.now() - new Date(item.purchased_at)) / (new Date(item.ends_at) - new Date(item.purchased_at))) * 100)); }
function miningAnimation(item, progress) { if (item.status !== 'active') return `<p class="mining-complete">Cycle terminé</p>`; const stage = progress < 34 ? 'extraction' : progress < 67 ? 'processing' : 'production'; const label = stage === 'extraction' ? 'Extraction en cours' : stage === 'processing' ? 'Traitement en cours' : 'Production en cours'; return `<div class="mining-animation ${stage}" role="img" aria-label="${label}, progression ${Math.floor(progress)} pour cent"><div class="mining-track"><span class="mining-step"><i>◇</i>Extraction</span><span class="mining-step"><i>⚙</i>Traitement</span><span class="mining-step"><i>✦</i>Production</span><b class="mining-cart">◆</b></div><div class="mining-stage"><span>${label}</span><strong>${Math.floor(progress)} %</strong></div></div>`; }
function renderDashboard(data) {
  dashboard = data;
  const { profile, wallet, investments, recentTransactions, notifications, referral } = data;
  const fullName = `${profile.first_name} ${profile.last_name}`;
  $('#page-title').textContent = `Bonjour, ${profile.username}`;
  $('#header-username').textContent = profile.username;
  $('#header-avatar').textContent = initials(profile.username);
  $('#card-name').textContent = fullName.toUpperCase(); $('#card-id').textContent = profile.client_code;
  $('#card-balance').textContent = formatMoney(wallet.available_balance);
  $('#pending-balance').textContent = formatMoney(wallet.pending_balance); $('#bonus-balance').textContent = formatMoney(wallet.bonus_balance);
  $('#referral-balance').textContent = formatMoney(wallet.referral_balance); $('#gains-balance').textContent = formatMoney(wallet.total_gains_received);
  $('#unread-count').textContent = notifications.filter((item) => !item.read_at).length;
  const active = investments.find((item) => item.status === 'active');
  $('#next-gain').textContent = active ? formatDate(active.next_gain_at) : 'Aucun investissement actif';
  const investmentMarkup = investments.slice(0, 4).length ? investments.slice(0, 4).map((item) => {
    const progress = investmentProgress(item);
    return `<article class="investment-item"><div class="investment-line"><span class="ore-icon">◇</span><div><strong>${escape(item.mineral_name)} · ${item.term === 'short' ? 'Court terme' : 'Long terme'}</strong><p>${formatMoney(item.price_xof)} · ${formatMoney(item.daily_gain_xof)}/jour</p></div><span>${item.status === 'active' ? 'ACTIF' : 'TERMINÉ'}</span></div><div class="progress"><i style="width:${progress}%"></i></div></article>`;
  }).join('') : `<div class="empty-mini">Aucun investissement pour le moment.</div>`;
  $('#investment-list').innerHTML = investmentMarkup;
  $('#my-investments-list').innerHTML = investments.length ? investments.map((item) => { const progress = investmentProgress(item); return `<article class="investment-item detailed"><div class="investment-line"><span class="ore-icon">◇</span><div><strong>${escape(item.mineral_name)} · ${item.term === 'short' ? 'Court terme' : 'Long terme'}</strong><p>Acheté le ${formatDate(item.purchased_at)}</p></div><span>${item.status === 'active' ? 'ACTIF' : 'TERMINÉ'}</span></div><div class="investment-details"><span>Montant <b>${formatMoney(item.price_xof)}</b></span><span>Gain/jour <b>${formatMoney(item.daily_gain_xof)}</b></span><span>Gains reçus <b>${formatMoney(item.gains_received_xof)}</b></span><span>Prochain gain <b>${formatDate(item.next_gain_at)}</b></span><span>Fin <b>${formatDate(item.ends_at)}</b></span></div><div class="progress"><i style="width:${progress}%"></i></div>${miningAnimation(item, progress)}<p class="progress-note">Extraction → traitement → production · ${Math.floor(progress)} %</p></article>`; }).join('') : `<div class="empty-mini">Aucun investissement pour le moment.</div>`;
  $('#activity-list').innerHTML = recentTransactions.length ? recentTransactions.map((item) => `<article class="activity-item"><span class="activity-icon">${({ deposit: '↓', investment: '◇', gain: '↗', referral_commission: '♧', bonus: '✦', withdrawal: '↑', refund: '↩', correction: '•' })[item.type] ?? '•'}</span><div><strong>${escape(item.type.replaceAll('_', ' '))}</strong><p>${formatDate(item.created_at)}</p></div><div><strong>${formatMoney(item.amount_xof)}</strong><p>${escape(item.status)}</p></div></article>`).join('') : `<div class="empty-mini">Aucune opération récente.</div>`;
  $('#referral-copy').textContent = referral ? `Votre code ${referral.code} · ${referral.direct_referrals} filleul${referral.direct_referrals > 1 ? 's' : ''} direct${referral.direct_referrals > 1 ? 's' : ''}.` : 'Votre code de parrainage sera disponible après activation.';
}

function renderAccount(data) {
  const account = data.account; const fullName = `${account.first_name} ${account.last_name}`;
  $('#profile-avatar').textContent = initials(account.username); $('#profile-username').textContent = account.username; $('#profile-code').textContent = account.client_code;
  const rows = [['Nom complet', fullName], ['E-mail', account.email], ['Date de naissance', new Intl.DateTimeFormat('fr-FR').format(new Date(account.birth_date))], ['Numéro Wave', account.wave_number], ['Date de création', formatDate(account.created_at)], ['Statut', account.status === 'active' ? 'Actif' : account.status]];
  $('#account-details').innerHTML = rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('');
}

function renderSecurity(data) {
  const item = data.security;
  $('#security-status').innerHTML = `<article><span>E-MAIL</span><strong class="success">${item.email_verified_at ? '✓ Vérifié' : 'Non vérifié'}</strong></article><article><span>COMPTE</span><strong class="success">${escape(item.status)}</strong></article><article><span>DERNIÈRE CONNEXION</span><strong>${formatDate(item.last_login_at)}</strong></article>`;
  $('#sessions-list').innerHTML = data.sessions.length ? data.sessions.map((session) => `<article class="activity-item"><span class="activity-icon">◌</span><div><strong>${escape(session.user_agent || 'Appareil non identifié')}</strong><p>Actif depuis ${formatDate(session.created_at)}</p></div><div><p>${formatDate(session.last_seen_at)}</p></div></article>`).join('') : '<div class="empty-mini">Aucune session active.</div>';
  $('#security-events').innerHTML = data.events.length ? data.events.map((event) => `<article class="activity-item"><span class="activity-icon">⌑</span><div><strong>${escape(event.event_type)}</strong><p>${escape(event.result)} · ${formatDate(event.created_at)}</p></div></article>`).join('') : '<div class="empty-mini">Aucun événement de sécurité enregistré.</div>';
}

function renderWallet(data) {
  const wallet = data.wallet ?? { available_balance: 0, pending_balance: 0, bonus_balance: 0, referral_balance: 0, total_gains_received: 0 };
  $('#wallet-total').textContent = formatMoney(wallet.available_balance); $('#wallet-pending').textContent = formatMoney(wallet.pending_balance);
  $('#wallet-bonus').textContent = formatMoney(wallet.bonus_balance); $('#wallet-referral').textContent = formatMoney(wallet.referral_balance); $('#wallet-gains').textContent = formatMoney(wallet.total_gains_received);
  $('#wallet-updated').textContent = `Mis à jour ${formatDate(wallet.updated_at)}`;
  $('#wallet-entries').innerHTML = data.entries.length ? data.entries.map((entry) => `<article class="activity-item"><span class="activity-icon">${entry.amount_xof > 0 ? '↓' : '↑'}</span><div><strong>${escape(entry.reason)}</strong><p>${formatDate(entry.created_at)} · ${escape(entry.balance_bucket)}</p></div><div><strong>${entry.amount_xof > 0 ? '+' : ''}${formatMoney(entry.amount_xof)}</strong><p>${escape(entry.status)}</p></div></article>`).join('') : '<div class="empty-mini">Votre registre est vide. Les opérations validées apparaîtront ici.</div>';
  $('#history-entries').innerHTML = data.entries.length ? data.entries.map((entry) => `<article class="activity-item"><span class="activity-icon">${entry.amount_xof > 0 ? '↓' : '↑'}</span><div><strong>${escape(entry.reason)}</strong><p>ID ${escape(entry.id)} · ${formatDate(entry.created_at)} · ${escape(entry.balance_bucket)}</p><p>Référence : ${escape(entry.reference ?? '—')}</p></div><div><strong>${entry.amount_xof > 0 ? '+' : ''}${formatMoney(entry.amount_xof)}</strong><p>${escape(entry.status)}</p></div></article>`).join('') : '<div class="empty-mini">Aucune transaction pour le moment.</div>';
}

function renderOffers() {
  const visible = offers.filter((offer) => offer.term === activeTerm);
  $('#offers-list').innerHTML = visible.map((offer) => `<article class="offer-card"><span class="ore">◇</span><h3>${escape(offer.mineral_name)}</h3><p>${offer.term === 'short' ? 'Formule court terme' : 'Formule long terme'}</p><strong>${formatMoney(offer.price_xof)}</strong><div class="offer-meta"><span>${offer.duration_days} jours</span><span>${formatMoney(offer.daily_gain_xof)}/jour</span></div><button data-offer="${offer.id}">Choisir cette offre</button></article>`).join('');
  document.querySelectorAll('[data-offer]').forEach((button) => button.addEventListener('click', () => buyOffer(button.dataset.offer)));
}

async function buyOffer(offerId) {
  if (!window.confirm('Confirmer l’activation de cet investissement depuis votre solde disponible ?')) return;
  const response = await fetch('/api/investments', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ offerId }) });
  const payload = await response.json();
  if (!response.ok) { alert(payload.error?.message ?? 'Opération impossible.'); return; }
  alert('Investissement activé. Votre premier gain sera crédité 24 heures après l’achat.');
  window.location.hash = 'dashboard'; window.location.reload();
}

function renderDeposits() {
  $('#deposit-amounts').innerHTML = depositAmounts.map((amount) => `<article class="offer-card"><span class="ore">↓</span><h3>${formatMoney(amount)}</h3><p>Versement Wave</p><button data-deposit="${amount}">Choisir ce montant</button></article>`).join('');
  document.querySelectorAll('[data-deposit]').forEach((button) => button.addEventListener('click', () => startWavePayment(Number(button.dataset.deposit))));
  const selectedAmount = Number(localStorage.getItem('pxDepositAmount'));
  if (selectedAmount && depositAmounts.includes(selectedAmount)) showDepositRequest(selectedAmount);
}
function startWavePayment(amountXof) {
  if (!waveCheckoutUrl) return alert('Le lien Wave Business est momentanément indisponible. Réessayez dans un instant.');
  localStorage.setItem('pxDepositAmount', String(amountXof));
  window.location.assign(waveCheckoutUrl);
}
function showDepositRequest(amountXof) {
  $('#deposit-payment').classList.remove('hidden');
  $('#deposit-payment-copy').textContent = `Montant choisi : ${formatMoney(amountXof)}. Après paiement sur Wave, cliquez ci-dessous pour transmettre votre référence.`;
  $('#start-deposit-request').onclick = () => {
    $('#deposit-request-form').classList.remove('hidden');
    $('#start-deposit-request').classList.add('hidden');
  };
  $('#deposit-request-form').onsubmit = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/deposits', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ amountXof, waveReference: $('#deposit-wave-reference').value.trim(), payerWaveNumber: $('#deposit-payer-number').value.trim() }) });
  const payload = await response.json();
    if (!response.ok) { alert(payload.error?.message ?? 'Demande impossible.'); return; }
    localStorage.removeItem('pxDepositAmount');
    $('#deposit-request-form').classList.add('hidden');
    $('#deposit-payment-copy').textContent = `Demande ${payload.clientReference} envoyée. Votre dépôt est en attente de vérification.`;
    alert('Votre demande de dépôt a été envoyée. Elle sera vérifiée avant tout crédit du portefeuille.');
  };
}
function renderWithdrawalQuote() {
  const amount = Number($('#withdrawal-amount').value);
  if (!Number.isInteger(amount) || amount <= 0) { $('#withdrawal-quote').textContent = 'Saisissez un montant pour visualiser la commission.'; return; }
  const commission = Math.floor(amount * (amount >= 500000 ? .35 : .25));
  $('#withdrawal-quote').textContent = `Commission : ${formatMoney(commission)} · Montant net Wave : ${formatMoney(amount - commission)}`;
}
async function createWithdrawal() {
  const amountXof = Number($('#withdrawal-amount').value);
  if (!Number.isInteger(amountXof) || amountXof <= 0) { alert('Saisissez un montant entier valide.'); return; }
  const response = await fetch('/api/withdrawals', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ amountXof }) });
  const payload = await response.json();
  if (!response.ok) { alert(payload.error?.message ?? 'Demande impossible.'); return; }
  alert(`Demande créée. Commission : ${formatMoney(payload.commissionXof)}. Montant net : ${formatMoney(payload.netAmountXof)}. Elle est en attente de validation.`); window.location.hash = 'wallet'; window.location.reload();
}
function renderBonus(data) { bonusData = data; $('#bonus-total').textContent = formatMoney(data.bonusBalance); }
function renderReferral(data) {
  referralData = data; $('#referral-code').textContent = data.code ?? '—'; $('#referral-minimum').textContent = `Minimum de retrait des commissions : ${formatMoney(data.minimumWithdrawalXof)}.`;
  $('#referral-link').textContent = data.code ? `${window.location.origin}/app/register.html?ref=${encodeURIComponent(data.code)}` : 'Votre lien sera disponible après activation.';
  const byLevel = Object.fromEntries(data.stats.map((item) => [item.level, item.total]));
  $('#referral-stats').innerHTML = [1, 2, 3].map((level) => `<article><span>NIVEAU ${level}</span><strong>${byLevel[level] ?? 0}</strong><i>${({ 1: '30 % du premier dépôt', 2: '5 % du premier dépôt', 3: '4 % du premier dépôt' })[level]}</i></article>`).join('');
  $('#commissions-list').innerHTML = data.commissions.length ? data.commissions.map((item) => `<article class="activity-item"><span class="activity-icon">♧</span><div><strong>Commission niveau ${item.level}</strong><p>${formatDate(item.created_at)}</p></div><div><strong>+${formatMoney(item.amount_xof)}</strong><p>${Number(item.rate_basis_points) / 100}%</p></div></article>`).join('') : '<div class="empty-mini">Aucune commission reçue pour le moment.</div>';
}
function renderNotifications(data) {
  notificationsData = data;
  $('#notifications-list').innerHTML = data.notifications.length ? data.notifications.map((item) => `<article class="activity-item ${item.read_at ? '' : 'notification-unread'}" data-notification="${item.id}"><span class="activity-icon">◉</span><div><strong>${escape(item.title)}</strong><p>${escape(item.message)}</p></div><div><p>${formatDate(item.created_at)}</p></div></article>`).join('') : '<div class="empty-mini">Vous n’avez aucune notification.</div>';
  document.querySelectorAll('[data-notification]').forEach((node) => node.addEventListener('click', async () => { await fetch(`/api/notifications/${node.dataset.notification}/read`, { method: 'POST', credentials: 'same-origin' }); node.classList.remove('notification-unread'); }));
}
function renderDocuments(data) { documentsData = data; $('#documents-list').innerHTML = data.documents.length ? data.documents.map((item) => `<article class="offer-card"><span class="ore">▤</span><h3>${escape(item.title)}</h3><p>${escape(item.description ?? 'Document PX MINERALS')}</p><div class="offer-meta"><span>${escape(item.file_name ?? 'Document')}</span><span>${formatDate(item.published_at)}</span></div></article>`).join('') : '<div class="empty-mini">Aucun document publié pour votre compte.</div>'; }
function renderTickets(data) { ticketsData = data; $('#tickets-list').innerHTML = data.tickets.length ? data.tickets.map((ticket) => `<button type="button" class="activity-item ticket-item" data-ticket-id="${ticket.id}"><span class="activity-icon">◖</span><div><strong>${escape(ticket.subject)}</strong><p>${escape(ticket.ticket_number)} · ${formatDate(ticket.updated_at)}</p></div><div><strong>${escape(ticket.status)}</strong></div></button>`).join('') : '<div class="empty-mini">Vous n’avez aucun ticket.</div>'; document.querySelectorAll('[data-ticket-id]').forEach((node) => node.addEventListener('click', () => openTicket(node.dataset.ticketId))); }
async function openTicket(ticketId) { const data = await request(`/api/support/${ticketId}`); selectedTicketId = ticketId; $('#ticket-conversation').classList.remove('hidden'); $('#ticket-conversation-title').textContent = `${data.ticket.ticket_number} · ${data.ticket.subject}`; $('#ticket-messages').innerHTML = data.messages.map((item) => `<article class="activity-item"><span class="activity-icon">${item.author_role === 'admin' ? '•' : '◖'}</span><div><strong>${item.author_role === 'admin' ? 'Support' : 'Vous'}</strong><p>${escape(item.message)}</p></div><div><p>${formatDate(item.created_at)}</p></div></article>`).join('') || '<div class="empty-mini">Aucun message.</div>'; $('#ticket-reply-area').classList.toggle('hidden', data.ticket.status === 'resolved'); $('#ticket-conversation').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function replyToTicket() { if (!selectedTicketId) return; const message = $('#ticket-reply').value.trim(); if (!message) return alert('Écrivez un message.'); const response = await fetch(`/api/support/${selectedTicketId}/messages`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }); const data = await response.json(); if (!response.ok) return alert(data.error?.message ?? 'Message impossible à envoyer.'); $('#ticket-reply').value = ''; await openTicket(selectedTicketId); renderTickets(await request('/api/support')); }
async function createTicket() { const subject = $('#ticket-subject').value.trim(), message = $('#ticket-message').value.trim(); if (!subject || !message) { alert('Veuillez saisir un sujet et un message.'); return; } const response = await fetch('/api/support', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, message }) }); const data = await response.json(); if (!response.ok) { alert(data.error?.message ?? 'Impossible de créer le ticket.'); return; } alert(`Ticket ${data.ticketNumber} créé.`); window.location.reload(); }
async function redeemBonus() {
  const code = $('#bonus-code').value.trim(); if (!code) { alert('Saisissez un code bonus.'); return; }
  const response = await fetch('/api/bonuses/redeem', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  const payload = await response.json(); if (!response.ok) { alert(payload.error?.message ?? 'Code invalide.'); return; }
  alert(`${formatMoney(payload.amountXof)} ajoutés à votre solde bonus.`); window.location.reload();
}

function showView(name) {
  document.querySelectorAll('.view').forEach((view) => view.classList.add('hidden'));
  document.querySelectorAll('.navigation a').forEach((link) => link.classList.toggle('active', link.dataset.view === name));
  const specific = $(`#${name}-view`);
  if (specific) { specific.classList.remove('hidden'); } else { $('#empty-view').classList.remove('hidden'); $('#empty-title').textContent = name.charAt(0).toUpperCase() + name.slice(1); }
  const titles = { dashboard: ['ESPACE CLIENT', `Bonjour, ${dashboard?.profile?.username ?? ''}`], investments: ['OFFRES VERROUILLÉES', 'Investissements'], 'my-investments': ['VOS POSITIONS', 'Mes investissements'], deposit: ['APPROVISIONNEMENT', 'Effectuer un dépôt'], withdrawal: ['RETRAIT WAVE', 'Demander un retrait'], bonus: ['AVANTAGES', 'Bonus'], referral: ['VOTRE RÉSEAU', 'Parrainage'], notifications: ['VOS ALERTES', 'Notifications'], documents: ['RESSOURCES', 'Documents'], support: ['ASSISTANCE', 'Support'], wallet: ['VOS AVOIRS', 'Portefeuille'], history: ['REGISTRE SÉCURISÉ', 'Historique des transactions'], account: ['VOS INFORMATIONS', 'Mon compte'], security: ['PROTECTION DU COMPTE', 'Sécurité'] };
  $('#page-kicker').textContent = titles[name]?.[0] ?? 'ESPACE CLIENT'; $('#page-title').textContent = titles[name]?.[1] ?? name.charAt(0).toUpperCase() + name.slice(1);
  $('#sidebar').classList.remove('open');
}

async function init() {
  try { const data = await request('/api/client/dashboard'); renderDashboard(data); renderAccount(await request('/api/client/account')); renderSecurity(await request('/api/client/security')); renderWallet(await request('/api/client/wallet')); renderBonus(await request('/api/bonuses')); renderReferral(await request('/api/referrals')); renderNotifications(await request('/api/notifications')); renderDocuments(await request('/api/documents')); renderTickets(await request('/api/support')); offers = (await request('/api/investments/offers')).offers; renderOffers(); const depositData = await request('/api/deposits'); depositAmounts = depositData.allowedAmounts; waveCheckoutUrl = depositData.checkoutUrl; renderDeposits(); $('#today').textContent = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()); $('#loading').classList.add('hidden'); showView(location.hash.slice(1) || 'dashboard'); } catch (error) { $('#loading').innerHTML = `<p>${escape(error.message)}</p>`; }
}
document.querySelectorAll('[data-view]').forEach((link) => link.addEventListener('click', () => setTimeout(() => showView(link.dataset.view), 0)));
window.addEventListener('hashchange', () => showView(location.hash.slice(1) || 'dashboard'));
$('#menu-button').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#account-button').addEventListener('click', () => { const menu = $('.account-menu'); menu.classList.toggle('open'); $('#account-button').setAttribute('aria-expanded', String(menu.classList.contains('open'))); });
$('#logout-button').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); window.location.replace('/app/login.html'); });
$('#copy-referral').addEventListener('click', async () => { if (!dashboard?.referral?.code) return; await navigator.clipboard.writeText(dashboard.referral.code); $('#copy-referral').textContent = 'Code copié ✓'; setTimeout(() => { $('#copy-referral').textContent = 'Copier le code'; }, 1800); });
document.querySelectorAll('[data-term]').forEach((button) => button.addEventListener('click', () => { activeTerm = button.dataset.term; document.querySelectorAll('[data-term]').forEach((tab) => tab.classList.toggle('active', tab === button)); renderOffers(); }));
$('#withdrawal-amount').addEventListener('input', renderWithdrawalQuote); $('#withdrawal-submit').addEventListener('click', createWithdrawal);
$('#request-wave-change').addEventListener('click',async()=>{const waveNumber=$('#new-wave-number').value.trim();if(!waveNumber)return alert('Saisissez votre nouveau numéro Wave.');try{const response=await fetch('/api/client/wave-number-change-requests',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({waveNumber})});const data=await response.json().catch(()=>({}));if(!response.ok)return alert(data.error?.message??'Demande impossible.');alert(data.message);$('#new-wave-number').value=''}catch{alert('Demande impossible.')}});
$('#bonus-submit').addEventListener('click', redeemBonus);
$('#copy-referral-page').addEventListener('click', async () => { if (!referralData?.code) return; await navigator.clipboard.writeText(referralData.code); $('#copy-referral-page').textContent = 'Copié ✓'; setTimeout(() => { $('#copy-referral-page').textContent = 'Copier'; }, 1800); });
$('#copy-referral-link').addEventListener('click', async () => { if (!referralData?.code) return; await navigator.clipboard.writeText(`${window.location.origin}/app/register.html?ref=${encodeURIComponent(referralData.code)}`); $('#copy-referral-link').textContent = 'Lien copié ✓'; setTimeout(() => { $('#copy-referral-link').textContent = 'Copier le lien'; }, 1800); });
$('#share-referral-link').addEventListener('click', async () => { if (!referralData?.code) return; const link = `${window.location.origin}/app/register.html?ref=${encodeURIComponent(referralData.code)}`; if (navigator.share) { await navigator.share({ title: 'PX MINERALS', text: 'Rejoignez PX MINERALS avec mon lien de parrainage.', url: link }); } else { await navigator.clipboard.writeText(link); alert('Lien copié. Vous pouvez maintenant le partager.'); } });
$('#read-notifications').addEventListener('click', async () => { await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'same-origin' }); document.querySelectorAll('.notification-unread').forEach((node) => node.classList.remove('notification-unread')); $('#unread-count').textContent = '0'; });
$('#ticket-submit').addEventListener('click', createTicket);
$('#ticket-reply-submit').addEventListener('click', replyToTicket);
init();
